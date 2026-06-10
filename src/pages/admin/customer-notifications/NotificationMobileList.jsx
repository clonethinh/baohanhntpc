import { Button as MobileButton, Card as MobileCard, Dialog, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
import { ClockCircleOutline, EditSOutline, DeleteOutline } from 'antd-mobile-icons';
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
          <MobileCard key={row.id} className="admin-mobile-card" style={{ borderRadius: 16 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gap: 4, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}>{row.title}</div>
                  <MobileSpace wrap>
                    <MobileTag color={row.displayType === 'popup' ? 'warning' : 'primary'}>{row.displayType === 'popup' ? t('adminCustomerNotifications.popup') : t('adminCustomerNotifications.banner')}</MobileTag>
                    <MobileTag color={meta.mobileColor}>{meta.label}</MobileTag>
                    <MobileTag color={Number(row.priority || 0) > 0 ? 'danger' : 'default'}>{t('adminCustomerNotifications.priority')}: {row.priority || 0}</MobileTag>
                  </MobileSpace>
                </div>
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc' }}>
                <RichNotificationContent html={row.content} style={{ color: 'var(--adm-color-text)', fontSize: 13, lineHeight: 1.6 }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--adm-color-weak)' }}>
                <ClockCircleOutline />
                <span>{scheduleText(t, row)}</span>
              </div>

              <MobileSpace wrap style={{ '--gap': '8px' }}>
                <MobileButton size="small" fill="outline" onClick={() => openEdit(row)} disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`}>
                  <EditSOutline /> {t('button.sua')}
                </MobileButton>
                <MobileButton size="small" color={row.isActive ? 'warning' : 'success'} disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`} onClick={() => Dialog.confirm({ content: row.isActive ? t('adminCustomerNotifications.pauseConfirm') : t('adminCustomerNotifications.activateConfirm'), onConfirm: () => toggleStatus(row) })}>
                  {row.isActive ? t('adminCustomerNotifications.pause') : t('adminCustomerNotifications.activate')}
                </MobileButton>
                <MobileButton size="small" color="danger" disabled={submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`} onClick={() => Dialog.confirm({ content: t('adminCustomerNotifications.deleteConfirm'), onConfirm: async () => { await deleteRow(row); } })}>
                  <DeleteOutline /> {t('button.xoa')}
                </MobileButton>
              </MobileSpace>
            </div>
          </MobileCard>
        );
      })}
    </>
  );
}
