import { useState, useEffect } from 'react';
import { Modal, Button, Typography, Avatar, List } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { nhanVienService } from '../../services/warrantyService';
import { useAuth } from '../../contexts/AuthContext';

export default function StaffPickerModal() {
  const { t } = useTranslation();
  const { currentStaff, setCurrentStaff } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!currentStaff) {
      setLoading(true);
      nhanVienService.getList()
        .then(res => {
          if (res.data.success) setStaffList(res.data.data);
        })
        .catch(() => {
          setStaffList([
            { maNV: 'admin', tenNV: 'Admin', role: 'admin' },
            { maNV: 'nv001', tenNV: 'Nguy\u1ec5n V\u0103n An', role: 'staff' },
          ]);
        })
        .finally(() => setLoading(false));
    }
  }, [currentStaff]);

  if (currentStaff) return null;

  return (
    <Modal
      open={true}
      closable={false}
      maskClosable={false}
      footer={null}
      width={400}
      centered
      className="staff-picker-modal"
    >
      <Typography.Title level={4} style={{ textAlign: 'center', marginBottom: 8 }}>
        {t('staffPicker.title')}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 16 }}>
        {t('staffPicker.description')}
      </Typography.Text>
      <List
        loading={loading}
        dataSource={staffList}
        renderItem={nv => (
          <List.Item
            className={`staff-picker-item ${selected === nv.maNV ? 'is-selected' : ''}`}
            style={{
              cursor: 'pointer',
              padding: '12px 16px',
              borderRadius: 8,
            }}
            onClick={() => setSelected(nv.maNV)}
          >
            <List.Item.Meta
              avatar={<Avatar icon={<UserOutlined />} />}
              title={nv.tenNV}
              description={nv.maNV}
            />
          </List.Item>
        )}
      />
      <Button
        type="primary"
        block
        size="large"
        style={{ marginTop: 16 }}
        disabled={!selected}
        onClick={() => {
          const nv = staffList.find(x => x.maNV === selected);
          if (nv) setCurrentStaff(nv);
        }}
      >
        {t('button.xacNhan')}
      </Button>
    </Modal>
  );
}
