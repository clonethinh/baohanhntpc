import { Col, Input, Row, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Button as MobileButton, Input as MobileInput, Selector, Space as MobileSpace } from 'antd-mobile';
import { Typography } from 'antd';

const { Text } = Typography;

function MobileFilterSelectors({ displayType, setDisplayType, activeFilter, setActiveFilter, effectiveStatus, setEffectiveStatus, displayOptions, activeOptions, effectiveOptions, t }) {
  return (
    <MobileSpace direction="vertical" block style={{ '--gap': '10px' }}>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--adm-color-weak)', fontWeight: 600 }}>{t('adminCustomerNotifications.displayType')}</div>
        <Selector value={[displayType]} options={displayOptions.map((x) => ({ label: x.label, value: x.value }))} onChange={(arr) => setDisplayType(arr[0] ?? '')} />
      </div>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--adm-color-weak)', fontWeight: 600 }}>{t('adminCustomerNotifications.activeStatus')}</div>
        <Selector value={[activeFilter]} options={activeOptions.map((x) => ({ label: x.label, value: x.value }))} onChange={(arr) => setActiveFilter(arr[0] ?? '')} />
      </div>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--adm-color-weak)', fontWeight: 600 }}>{t('adminCustomerNotifications.allEffectiveStatus')}</div>
        <Selector value={[effectiveStatus]} options={effectiveOptions.map((x) => ({ label: x.label, value: x.value }))} onChange={(arr) => setEffectiveStatus(arr[0] ?? '')} />
      </div>
    </MobileSpace>
  );
}

export default function NotificationFilters(props) {
  const {
    t,
    mobile = false,
    search,
    setSearch,
    displayType,
    setDisplayType,
    activeFilter,
    setActiveFilter,
    effectiveStatus,
    setEffectiveStatus,
    displayOptions,
    activeOptions,
    effectiveOptions,
    handleSearch,
    openCreate,
    resetFilters,
  } = props;

  if (mobile) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <Text style={{ fontSize: 12, color: 'var(--adm-color-weak)', fontWeight: 600 }}>{t('button.timKiem')}</Text>
          <MobileInput placeholder={t('adminCustomerNotifications.searchPlaceholder')} value={search} onChange={setSearch} clearable />
        </div>
        <MobileFilterSelectors
          displayType={displayType}
          setDisplayType={setDisplayType}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          effectiveStatus={effectiveStatus}
          setEffectiveStatus={setEffectiveStatus}
          displayOptions={displayOptions}
          activeOptions={activeOptions}
          effectiveOptions={effectiveOptions}
          t={t}
        />
        <MobileSpace wrap style={{ '--gap': '8px' }}>
          <MobileButton size="small" onClick={handleSearch}>{t('button.timKiem')}</MobileButton>
          <MobileButton size="small" onClick={resetFilters}>{t('button.datLai')}</MobileButton>
          <MobileButton size="small" color="primary" onClick={openCreate}>+ {t('adminCustomerNotifications.add')}</MobileButton>
        </MobileSpace>
      </div>
    );
  }

  return (
    <Row gutter={[12, 12]} align="bottom" wrap>
      <Col xs={24} md={12} lg={8} xl={6}>
        <div className="notif-filter-field">
          <span className="notif-filter-label">{t('button.timKiem')}</span>
          <Input
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            placeholder={t('adminCustomerNotifications.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
        </div>
      </Col>
      <Col xs={24} md={12} lg={5} xl={4}>
        <div className="notif-filter-field">
          <span className="notif-filter-label">{t('adminCustomerNotifications.displayType')}</span>
          <Select value={displayType} onChange={setDisplayType} options={displayOptions} />
        </div>
      </Col>
      <Col xs={24} md={12} lg={5} xl={4}>
        <div className="notif-filter-field">
          <span className="notif-filter-label">{t('adminCustomerNotifications.activeStatus')}</span>
          <Select value={activeFilter} onChange={setActiveFilter} options={activeOptions} />
        </div>
      </Col>
      <Col xs={24} md={12} lg={5} xl={4}>
        <div className="notif-filter-field">
          <span className="notif-filter-label">{t('adminCustomerNotifications.allEffectiveStatus')}</span>
          <Select value={effectiveStatus} onChange={setEffectiveStatus} options={effectiveOptions} />
        </div>
      </Col>
    </Row>
  );
}
