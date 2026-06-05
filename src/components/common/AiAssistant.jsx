import { useMemo, useRef, useState } from 'react';
import { Avatar, Badge, Button, Card, Drawer, Space, Tag, Timeline, Tooltip } from 'antd';
import {
  BarChartOutlined,
  BulbOutlined,
  CloseOutlined,
  CustomerServiceOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  PhoneOutlined,
  RobotOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { Bubble, Prompts, Sender, ThoughtChain, Welcome } from '@ant-design/x';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { nhanVienService, publicService, statsService } from '../../services/warrantyService';
import { getStatusBadgeColor } from '../../constants/badgeConfig';

const botAvatar = <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#2f6b2f' }} />;
const userAvatar = <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#59636f' }} />;

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

export default function AiAssistant() {
  const { t } = useTranslation(['ui', 'status']);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [thoughts, setThoughts] = useState(null);
  const listRef = useRef(null);

  const { currentStaff } = useAuth();
  const { isDark } = useTheme();

  const statusMeta = (status) => {
    const normalized = status === 'da_xong' ? 'da_tra' : status;
    const labelKey = normalized && ['dang_xu_ly', 'da_tra', 'huy', 'da_nhan'].includes(normalized) ? normalized : 'da_nhan';
    return { color: getStatusBadgeColor(labelKey), label: t(`status:trangThai.${labelKey}`) };
  };

  const promptItems = useMemo(() => {
    const common = [
      {
        key: 'policy',
        icon: <InfoCircleOutlined />,
        label: t('aiAssistant.prompt.policy'),
        description: t('aiAssistant.prompt.policyDesc'),
      },
      {
        key: 'contact',
        icon: <PhoneOutlined />,
        label: t('aiAssistant.prompt.contact'),
        description: t('aiAssistant.prompt.contactDesc'),
      },
      {
        key: 'sample',
        icon: <BulbOutlined />,
        label: t('aiAssistant.prompt.sample'),
        description: t('aiAssistant.prompt.sampleDesc'),
      },
    ];

    if (!currentStaff) return common;

    return [
      {
        key: 'stats',
        icon: <BarChartOutlined />,
        label: t('aiAssistant.prompt.stats'),
        description: t('aiAssistant.prompt.statsDesc'),
      },
      {
        key: 'staff',
        icon: <UsergroupAddOutlined />,
        label: t('aiAssistant.prompt.staff'),
        description: t('aiAssistant.prompt.staffDesc'),
      },
      ...common,
    ];
  }, [currentStaff, t]);

  const bubbleItems = useMemo(() => {
    const items = messages.map((msg) => ({
      key: msg.id,
      role: msg.role === 'user' ? 'user' : 'ai',
      content: msg.content,
    }));

    if (loading && !thoughts) {
      items.push({
        key: 'assistant-loading',
        role: 'ai',
        loading: true,
        content: '',
      });
    }

    return items;
  }, [loading, messages, thoughts]);

  const addAssistantMessage = (content) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random()}-assistant`, role: 'assistant', content },
    ]);
  };

  const executeAction = async (rawText) => {
    const text = rawText.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { id: `${Date.now()}-user`, role: 'user', content: text }]);
    setInputValue('');
    setLoading(true);
    setThoughts(null);

    const textLower = text.toLowerCase();
    const NTPCRegex = /(\\d{8}NTPC\\d+)/i;
    const hasNTPC = NTPCRegex.test(text);

    try {
      if (hasNTPC) {
        const code = text.match(NTPCRegex)[1].toUpperCase();

        setThoughts([
          { title: t('aiAssistant.thought.connectWarranty'), status: 'process' },
          { title: t('aiAssistant.thought.findDocument', { code }), status: 'pending' },
          { title: t('aiAssistant.thought.readStatus'), status: 'pending' },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 500));

        setThoughts([
          { title: t('aiAssistant.thought.connectWarranty'), status: 'success' },
          { title: t('aiAssistant.thought.findDocument', { code }), status: 'process' },
          { title: t('aiAssistant.thought.readStatus'), status: 'pending' },
        ]);

        const res = await publicService.track(code);

        setThoughts([
          { title: t('aiAssistant.thought.connectWarranty'), status: 'success' },
          { title: t('aiAssistant.thought.findDocument', { code }), status: 'success' },
          { title: t('aiAssistant.thought.readStatus'), status: 'success' },
        ]);
        await new Promise((resolve) => setTimeout(resolve, 250));

        if (res.data?.success && res.data?.data) {
          const item = res.data.data;
          const meta = statusMeta(item.trangThai);

          addAssistantMessage(
            <div className="ntpc-ai-answer">
              <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.foundWarranty')}</div>
              <Card
                size="small"
                className="ntpc-ai-result-card"
                title={
                  <Space>
                    <Badge status={item.trangThai === 'da_tra' ? 'success' : 'processing'} />
                    <span>{t('aiAssistant.answer.warrantyCode', { code: item.soChungTu })}</span>
                  </Space>
                }
                extra={<Tag color={meta.color}>{meta.label}</Tag>}
              >
                <Space orientation="vertical" size={5} className="ntpc-ai-card-body">
                  <div><strong>{t('field.khachHang')}:</strong> {item.khachHang} ({item.soDienThoai})</div>
                  <div><strong>{t('field.sanPham')}:</strong> {item.tenHang}</div>
                  {item.soSeri && <div><strong>S/N:</strong> {item.soSeri}</div>}
                  {item.loiLucNhan && <div><strong>{t('field.loiLucNhan')}:</strong> {item.loiLucNhan}</div>}
                  {item.ngayHenTra && (
                    <div><strong>{t('field.henTra')}:</strong> <span className="ntpc-ai-date">{dayjs(item.ngayHenTra).format('DD-MM-YYYY')}</span></div>
                  )}
                  {item.ngayTra && <div><strong>{t('field.ngayTraThucTe')}:</strong> {dayjs(item.ngayTra).format('DD-MM-YYYY')}</div>}
                </Space>

                {item.lichSu?.length > 0 && (
                  <div className="ntpc-ai-timeline">
                    <div className="ntpc-ai-section-label">{t('aiAssistant.answer.progressLog')}</div>
                    <Timeline
                      size="small"
                      items={item.lichSu.map((hist) => ({
                        color: hist.action.includes('Ho\xe0n th\xe0nh') || hist.action.includes('Tr\u1ea3 kh\xe1ch') ? 'green' : 'blue',
                        children: (
                          <div className="ntpc-ai-timeline-item">
                            <span>{dayjs(hist.at).format('DD/MM HH:mm')}</span> - <strong>{hist.action}</strong>
                            {hist.note && <div>{hist.note}</div>}
                          </div>
                        ),
                      }))}
                    />
                  </div>
                )}
              </Card>
            </div>
          );
        } else {
          addAssistantMessage(t('aiAssistant.answer.notFound', { code }));
        }
      } else if (includesAny(textLower, ['th\u1ed1ng k\xea', 'thong ke']) || textLower === 'stats') {
        if (!currentStaff) {
          addAssistantMessage(t('aiAssistant.answer.statsOnlyStaff'));
          return;
        }

        setThoughts([
          { title: t('aiAssistant.thought.connectStats'), status: 'process' },
          { title: t('aiAssistant.thought.summarizeStats'), status: 'pending' },
        ]);
        const res = await statsService.summary();

        if (res.data?.success && res.data?.data) {
          const s = res.data.data;
          addAssistantMessage(
            <div className="ntpc-ai-answer">
              <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.statsTitle')}</div>
              <div className="ntpc-ai-metric-grid">
                <div><span>{t('aiAssistant.answer.totalWarranties')}</span><strong>{s.totalWarranties}</strong></div>
                <div><span>{t('aiAssistant.answer.activeWarranties')}</span><strong>{s.activeWarranties}</strong></div>
                <div><span>{t('aiAssistant.answer.completedWarranties')}</span><strong>{s.completedWarranties}</strong></div>
                <div><span>{t('aiAssistant.answer.expiredWarranties')}</span><strong>{s.expiredWarranties || 0}</strong></div>
              </div>
              <div className="ntpc-ai-muted">{t('aiAssistant.answer.updatedAt', { time: dayjs().format('HH:mm:ss DD-MM-YYYY') })}</div>
            </div>
          );
        }
      } else if (includesAny(textLower, ['nh\xe2n vi\xean', 'nhan vien'])) {
        if (!currentStaff) {
          addAssistantMessage(t('aiAssistant.answer.staffLoginRequired'));
          return;
        }

        setThoughts([{ title: t('aiAssistant.thought.loadStaff'), status: 'process' }]);
        const res = await nhanVienService.getList();

        if (Array.isArray(res.data)) {
          const list = res.data.filter((nv) => nv.active);
          addAssistantMessage(
            <div className="ntpc-ai-answer">
              <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.activeStaffTitle', { count: list.length })}</div>
              <div className="ntpc-ai-staff-list">
                {list.map((nv) => (
                  <div key={nv.maNV}>
                    <Avatar size="small" icon={<UserOutlined />} />
                    <span><strong>{nv.tenNV}</strong> <code>{nv.maNV}</code> {nv.role === 'admin' ? t('aiAssistant.roleAdmin') : t('aiAssistant.roleStaff')}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      } else if (
        includesAny(textLower, ['quy \u0111\u1ecbnh', 'quy dinh', 'ch\xednh s\xe1ch', 'chinh sach']) ||
        textLower === 'policy'
      ) {
        addAssistantMessage(
          <div className="ntpc-ai-answer">
            <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.policyTitle')}</div>
            <ul>
              <li>{t('aiAssistant.answer.policyShipping')}</li>
              <li>{t('aiAssistant.answer.policyData')}</li>
              <li>{t('aiAssistant.answer.policyStamp')}</li>
              <li>{t('aiAssistant.answer.policyReject')}</li>
            </ul>
            <a href="https://nguyentanpc.com/pages/dieu-kien-bao-hanh" target="_blank" rel="noreferrer">
              {t('aiAssistant.answer.policyLink')}
            </a>
          </div>
        );
      } else if (
        includesAny(textLower, ['li\xean h\u1ec7', 'lien he', 'hotline', 'sdt']) ||
        textLower === 'contact'
      ) {
        addAssistantMessage(
          <div className="ntpc-ai-answer">
            <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.contactTitle')}</div>
            <div className="ntpc-ai-contact">
              <div><strong>{t('aiAssistant.answer.warrantyDepartment')}</strong> <a href="tel:0937632000">0937 63 2000</a></div>
              <div><strong>{t('aiAssistant.answer.feedbackHotline')}</strong> <a href="tel:0903602240">0903 602 240</a></div>
              <div><strong>{t('aiAssistant.answer.addressLabel')}</strong> {t('aiAssistant.answer.address')}</div>
            </div>
          </div>
        );
      } else if (includesAny(textLower, ['v\xed d\u1ee5', 'vi du', 'sample'])) {
        addAssistantMessage(
          <div className="ntpc-ai-answer">
            <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.sampleTitle')}</div>
            <ul>
              <li>{t('aiAssistant.answer.sampleCode')} <code>18052026NTPC1</code></li>
              <li>{t('aiAssistant.answer.samplePolicy')} <code>{t('aiAssistant.answer.samplePolicyQuestion')}</code></li>
              <li>{t('aiAssistant.answer.sampleContact')} <code>{t('aiAssistant.answer.sampleContactQuestion')}</code></li>
            </ul>
          </div>
        );
      } else {
        addAssistantMessage(
          <div className="ntpc-ai-answer">
            <div className="ntpc-ai-answer-title">{t('aiAssistant.answer.fallbackTitle')}</div>
            <ul>
              <li>{t('aiAssistant.answer.fallbackLookup')} <code>18052026NTPC1</code>.</li>
              <li>{t('aiAssistant.answer.fallbackPolicyContact')}</li>
              {currentStaff && <li>{t('aiAssistant.answer.fallbackStaff')}</li>}
            </ul>
          </div>
        );
      }
    } catch (err) {
      addAssistantMessage(t('aiAssistant.answer.cannotProcess'));
    } finally {
      setLoading(false);
      setThoughts(null);
      requestAnimationFrame(() => listRef.current?.scrollTo?.({ top: 'bottom', behavior: 'smooth' }));
    }
  };

  const handlePromptClick = ({ data }) => {
    const promptText = {
      policy: t('aiAssistant.prompt.policy'),
      contact: t('aiAssistant.answer.contactTitle'),
      sample: t('aiAssistant.answer.sampleTitle'),
      stats: t('aiAssistant.prompt.stats'),
      staff: t('aiAssistant.prompt.staff'),
    }[data.key] || String(data.label || '');

    executeAction(promptText);
  };

  return (
    <>
      <Tooltip title={t('aiAssistant.launcher')} placement="left">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<MessageOutlined />}
          onClick={() => setOpen(true)}
          className="ntpc-ai-launcher"
          aria-label={t('aiAssistant.openLabel')}
        />
      </Tooltip>

      <Drawer
        className="ntpc-ai-drawer"
        title={
          <Space>
            <Avatar className="ntpc-ai-title-avatar" icon={<CustomerServiceOutlined />} />
            <div>
              <div className="ntpc-ai-title">{t('aiAssistant.title')}</div>
              <div className="ntpc-ai-subtitle">Ant Design X Assistant</div>
            </div>
          </Space>
        }
        placement="right"
        size="large"
        onClose={() => setOpen(false)}
        open={open}
        extra={<Button type="text" icon={<CloseOutlined />} onClick={() => setOpen(false)} />}
        closable={false}
        styles={{
          body: {
            padding: 0,
            height: '100%',
            background: isDark ? '#141414' : '#f7f9f3',
          },
        }}
      >
        <div className="ntpc-ai-shell ntpc-ai-assistant-shell">
          <main className="ntpc-ai-main">
            <div className="ntpc-ai-messages">
              {messages.length === 0 ? (
                <div className="ntpc-ai-empty">
                  <Welcome
                    icon={<FileSearchOutlined />}
                    title={t('aiAssistant.welcomeTitle')}
                    description={t('aiAssistant.welcomeDescription')}
                  />
                </div>
              ) : (
                <Bubble.List
                  ref={listRef}
                  items={bubbleItems}
                  autoScroll
                  roles={{
                    ai: { placement: 'start', avatar: botAvatar, variant: 'shadow', shape: 'corner', typing: { step: 5, interval: 20 } },
                    user: { placement: 'end', avatar: userAvatar, variant: 'filled', shape: 'corner' },
                  }}
                />
              )}

              {thoughts && (
                <div className="ntpc-ai-thoughts">
                  <ThoughtChain items={thoughts} />
                </div>
              )}
            </div>

            <div className="ntpc-ai-prompts">
              <Prompts items={promptItems} onItemClick={handlePromptClick} wrap fadeIn />
            </div>

            <div className="ntpc-ai-sender-dock">
              <Sender
                value={inputValue}
                onChange={setInputValue}
                onSubmit={() => executeAction(inputValue)}
                placeholder={t('aiAssistant.placeholder')}
                loading={loading}
                allowSpeech
              />
            </div>
          </main>
        </div>
      </Drawer>
    </>
  );
}
