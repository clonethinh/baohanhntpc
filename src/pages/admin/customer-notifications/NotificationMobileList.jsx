import { Button as MobileButton, Card as MobileCard, Dialog, Space as MobileSpace, Tag as MobileTag } from 'antd-mobile';
import { ClockCircleOutline, EditSOutline, DeleteOutline, CheckCircleOutline, CloseCircleOutline } from 'antd-mobile-icons';
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
        const disabled = submitting || rowActionId === `toggle:${row.id}` || rowActionId === `delete:${row.id}`;
        return (
          <MobileCard key={row.id} className="admin-mobile-card" style={{ borderRadius: 14 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {/* Header: title + type tag */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35, flex: 1, minWidth: 0 }}>{row.title}</div>
                <MobileTag color={row.displayType === 'popup' ? 'warning' : 'primary'} style={{ flexShrink: 0 }}>
                  {row.displayType === 'popup' ? t('adminCustomerNotifications.popup') : t('adminCustomerNotifications.banner')}
                </MobileTag>
              </div>

              {/* Status + schedule inline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <MobileTag color={meta.mobileColor} style={{ margin: 0 }}>{meta.label}</MobileTag>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--adm-color-weak)' }}>
                  <ClockCircleOutline fontSize={12} />
                  {scheduleText(t, row)}
                </span>
              </div>

              {/* Content preview */}
              <div style={{ padding: '8px 10px', borderRadius: 10, background: 'var(--adm-color-fill-content, #f5f5f5)', maxHeight: 60, overflow: 'hidden' }}>
                <RichNotificationContent html={row.content} style={{ color: 'var(--adm-color-text)', fontSize: 13, lineHeight: 1.5 }} />
              </div>

              {/* Actions: icon-only buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 2 }}>
                <MobileButton
                  size="mini"
                  fill="outline"
                  onClick={() => openEdit(row)}
                  disabled={disabled}
                  style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                >
                  <EditSOutline fontSize={16} />
                </MobileButton>
                <MobileButton
                  size="mini"
                  color={row.isActive ? 'warning' : 'success'}
                  fill="outline"
                  disabled={disabled}
                  onClick={() => Dialog.confirm({
                    content: row.isActive ? t('adminCustomerNotifications.pauseConfirm') : t('adminCustomerNotifications.activateConfirm'),
                    onConfirm: () => toggleStatus(row),
                  })}
                  style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                >
                  {row.isActive ? <CloseCircleOutline fontSize={16} /> : <CheckCircleOutline fontSize={16} />}
                </MobileButton>
                <MobileButton
                  size="mini"
                  color="danger"
                  fill="outline"
                  disabled={disabled}
                  onClick={() => Dialog.confirm({
                    content: t('adminCustomerNotifications.deleteConfirm'),
                    onConfirm: async () => { await deleteRow(row); },
                  })}
                  style={{ display: 'flex', alignItems: 'center', gap: 2 }}
                >
                  <DeleteOutline fontSize={16} />
                </MobileButton>
              </div>
            </div>
          </MobileCard>
        );
      })}
    </>
  );
}
