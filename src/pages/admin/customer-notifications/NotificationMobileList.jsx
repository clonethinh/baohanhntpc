import { Button as MobileButton, Card as MobileCard, Dialog, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
import { RichNotificationContent } from '../../../components/customer/CustomerNotifications';
import { effectiveStatusMeta, scheduleText } from './helpers';

export default function NotificationMobileList({
  t,
  data,
  loading,
  openEdit,
  toggleStatus,
  deleteRow,
  submitting,
  rowActionId,
}) {
  return (
    <>
      {loading ? <MobileCard className="admin-mobile-card">{t('adminCustomer.loading')}</MobileCard> : null}

      {data.rows.map((row) => {
        const meta = effectiveStatusMeta(t, row);
        return (
          <MobileCard key={row.id} className="admin-mobile-card">
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b>{row.title}</b>
                <MobileTag color={row.displayType === 'popup' ? 'warning' : 'primary'}>{row.displayType === 'popup' ? t('adminCustomerNotifications.popup') : t('adminCustomerNotifications.banner')}</MobileTag>
              </div>
              <RichNotificationContent html={row.content} style={{ color: 'var(--adm-color-weak)', fontSize: 13, lineHeight: 1.55 }} />
              <MobileSpace wrap>
                <MobileTag color={meta.mobileColor}>{meta.label}</MobileTag>
                <MobileTag color="default">{t('adminCustomerNotifications.priority')}: {row.priority || 0}</MobileTag>
              </MobileSpace>
              <div style={{ fontSize: 12, color: 'var(--adm-color-weak)' }}>{scheduleText(t, row)}</div>
              <MobileSpace wrap>
                <MobileButton size="mini" onClick={() => openEdit(row)} disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`}>{t('button.sua')}</MobileButton>
                <MobileButton size="mini" color={row.isActive ? 'danger' : 'success'} disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`} onClick={() => Dialog.confirm({ content: row.isActive ? t('adminCustomerNotifications.pauseConfirm') : t('adminCustomerNotifications.activateConfirm'), onConfirm: () => toggleStatus(row) })}>
                  {row.isActive ? t('adminCustomerNotifications.pause') : t('adminCustomerNotifications.activate')}
                </MobileButton>
                <MobileButton size="mini" color="danger" disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`} onClick={() => Dialog.confirm({ content: t('adminCustomerNotifications.deleteConfirm'), onConfirm: async () => { await deleteRow(row, { notify: 'toast' }); } })}>{t('button.xoa')}</MobileButton>
              </MobileSpace>
            </div>
          </MobileCard>
        );
      })}
    </>
  );
}
