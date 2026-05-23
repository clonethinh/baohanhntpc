import { useMemo, useState } from 'react';
import { Button, Empty, Input, List, Modal, Space, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function CustomerPickerModal({
  open,
  customers = [],
  loading = false,
  title = 'Chọn khách hàng',
  excludedKey = '',
  onCancel,
  onSelect,
}) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((row) => row.key !== excludedKey)
      .filter((row) => {
        if (!q) return true;
        return (
          String(row.khachHang || '').toLowerCase().includes(q) ||
          String(row.soDienThoai || '').toLowerCase().includes(q) ||
          String(row.diaChi || '').toLowerCase().includes(q)
        );
      });
  }, [customers, excludedKey, query]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      footer={null}
      destroyOnHidden
      afterOpenChange={(visible) => {
        if (!visible) setQuery('');
      }}
    >
      <Space direction="vertical" size={12} style={{ display: 'flex' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Tìm theo tên, SĐT hoặc địa chỉ"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
        <List
          loading={loading}
          dataSource={rows}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có khách hàng phù hợp" /> }}
          style={{ maxHeight: 420, overflow: 'auto' }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="select" type="primary" size="small" onClick={() => onSelect?.(item)}>
                  Chọn
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={8} wrap>
                    <Text strong>{item.khachHang || '-'}</Text>
                    <Tag color="blue">{item.totalWarranties || 0} CT</Tag>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={2}>
                    <Text type="secondary">{item.soDienThoai || 'Chưa có SĐT'}</Text>
                    <Text type="secondary">{item.diaChi || 'Chưa có địa chỉ'}</Text>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Space>
    </Modal>
  );
}
