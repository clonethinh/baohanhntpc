import { Modal, Table } from 'antd';
import { useTranslation } from 'react-i18next';

const shortcutKeys = [
  { key: 'Ctrl + N', descKey: 'shortcuts.createWarranty' },
  { key: 'Ctrl + K', descKey: 'shortcuts.quickSearch' },
  { key: 'Ctrl + P', descKey: 'shortcuts.printWarranty' },
  { key: 'Esc', descKey: 'shortcuts.closeModal' },
  { key: '?', descKey: 'shortcuts.openShortcuts' },
];

export default function ShortcutsModal({ open, onClose }) {
  const { t } = useTranslation();
  const shortcuts = shortcutKeys.map((item) => ({ ...item, desc: t(item.descKey) }));

  return (
    <Modal title={t('shortcuts.title')} open={open} onCancel={onClose} footer={null} width={400}>
      <Table
        dataSource={shortcuts}
        columns={[
          { title: t('shortcuts.keyColumn'), dataIndex: 'key', width: 120, render: text => <kbd style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{text}</kbd> },
          { title: t('shortcuts.descColumn'), dataIndex: 'desc' },
        ]}
        pagination={false}
        size="small"
      />
    </Modal>
  );
}
