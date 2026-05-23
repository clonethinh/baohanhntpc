import { useState, useRef, useEffect } from 'react';
import { Input, Modal, List, Tag } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from '../../hooks/useDebounce';
import { warrantyService } from '../../services/warrantyService';
import { STATUS } from '../../constants/statusConfig';

export default function GlobalSearch() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    window.__focusSearch = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    };
  }, []);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      setLoading(true);
      warrantyService.getList({ search: debouncedSearch, page: 1, limit: 10 })
        .then(res => {
          if (res.data.success) setResults(res.data.data.rows);
        })
        .finally(() => setLoading(false));
    } else {
      setResults([]);
    }
  }, [debouncedSearch]);

  return (
    <>
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('search.shortcutPlaceholder')}
        style={{ width: 200 }}
        onClick={() => setOpen(true)}
        readOnly
      />
      <Modal
        open={open}
        onCancel={() => { setOpen(false); setSearch(''); setResults([]); }}
        footer={null}
        closable={false}
        width={500}
        styles={{ body: { padding: 0 } }}
      >
        <Input
          ref={inputRef}
          prefix={<SearchOutlined />}
          placeholder={t('search.placeholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="large"
          style={{ borderBottom: '1px solid #f0f0f0', borderRadius: 0 }}
          autoFocus
        />
        <div style={{ maxHeight: 400, overflow: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: 16, textAlign: 'center' }}>{t('search.loading')}</div>}
          {!loading && results.length === 0 && search.length >= 2 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#999' }}>{t('search.noResults')}</div>
          )}
          <List
            dataSource={results}
            renderItem={w => (
              <List.Item
                style={{ cursor: 'pointer', padding: '8px 12px' }}
                onClick={() => { setOpen(false); setSearch(''); navigate('/admin/phieu'); }}
              >
                <div>
                  <strong>{w.soChungTu}</strong> - {w.khachHang}
                  <div style={{ fontSize: 12, color: '#666' }}>{w.tenHang}</div>
                </div>
                <Tag color={STATUS[w.trangThai]?.color}>{STATUS[w.trangThai]?.label}</Tag>
              </List.Item>
            )}
          />
        </div>
      </Modal>
    </>
  );
}
