import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Typography, Avatar, List, Tag, Space, Radio } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { nhanVienService } from '../../services/warrantyService';
import { useAuth } from '../../contexts/AuthContext';

export default function StaffPickerModal({
  open,
  mode = 'initialPick',
  onClose,
  onPicked,
}) {
  const { t } = useTranslation();
  const { currentStaff, setCurrentStaff } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState('');

  const isSwitchMode = mode === 'switchStaff';
  const shouldOpen = typeof open === 'boolean' ? open : !currentStaff;
  const hideWhenPicked = !isSwitchMode && !!currentStaff;

  useEffect(() => {
    if (!shouldOpen) return;
    setLoading(true);
    nhanVienService.getList()
      .then((res) => {
        if (res.data?.success) setStaffList(res.data.data || []);
      })
      .catch(() => {
        setStaffList([
          { maNV: 'admin', tenNV: 'Admin', role: 'admin' },
          { maNV: 'nv001', tenNV: 'Nguyen Van An', role: 'staff' },
        ]);
      })
      .finally(() => setLoading(false));
  }, [shouldOpen]);

  useEffect(() => {
    if (!shouldOpen) return;
    setSelected(currentStaff?.maNV || '');
  }, [shouldOpen, currentStaff?.maNV]);

  const title = useMemo(() => (isSwitchMode ? t('action.doiNhanVien') : t('staffPicker.title')), [isSwitchMode, t]);
  const description = useMemo(() => (
    isSwitchMode
      ? t('staffPicker.changeDescription', { defaultValue: 'Vui long chon nhan vien de tiep tuc.' })
      : t('staffPicker.description')
  ), [isSwitchMode, t]);

  if (hideWhenPicked || !shouldOpen) return null;

  return (
    <Modal
      open={shouldOpen}
      title={title}
      closable={isSwitchMode}
      maskClosable={isSwitchMode}
      onCancel={isSwitchMode ? onClose : undefined}
      footer={null}
      width={460}
      centered
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: -4 }}>
        {description}
      </Typography.Paragraph>

      <Radio.Group value={selected} onChange={(e) => setSelected(e.target.value)} style={{ width: '100%' }}>
        <List
          loading={loading}
          dataSource={staffList}
          split
          renderItem={(nv) => {
            const isCurrent = currentStaff?.maNV && currentStaff.maNV === nv.maNV;
            return (
              <List.Item onClick={() => setSelected(nv.maNV)} style={{ cursor: 'pointer', paddingInline: 4 }}>
                <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space align="center" size={12}>
                    <Avatar icon={<UserOutlined />} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{nv.tenNV}</div>
                      <Typography.Text type="secondary">{nv.maNV}</Typography.Text>
                    </div>
                    {isCurrent ? <Tag color="blue" style={{ marginInlineEnd: 0 }}>Đang dùng</Tag> : null}
                  </Space>
                  <Radio value={nv.maNV} />
                </Space>
              </List.Item>
            );
          }}
        />
      </Radio.Group>

      <Button
        type="primary"
        block
        size="large"
        style={{ marginTop: 16 }}
        disabled={!selected}
        onClick={() => {
          const nv = staffList.find((x) => x.maNV === selected);
          if (!nv) return;
          setCurrentStaff(nv);
          onPicked?.(nv);
          if (isSwitchMode) onClose?.();
        }}
      >
        {t('button.xacNhan')}
      </Button>
    </Modal>
  );
}
