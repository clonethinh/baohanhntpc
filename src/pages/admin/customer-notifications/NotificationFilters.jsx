import { Button, Card, Col, Input, Row, Select, Space, Typography } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import { Button as MobileButton, Input as MobileInput, Selector, Space as MobileSpace } from 'antd-mobile';

const { Text } = Typography;

function FilterSelectors({ displayType, setDisplayType, activeFilter, setActiveFilter, effectiveStatus, setEffectiveStatus, displayOptions, activeOptions, effectiveOptions }) {
  return (
    <>
      <Col><Select style={{ width: 160 }} value={displayType} onChange={setDisplayType} options={displayOptions} /></Col>
      <Col><Select style={{ width: 180 }} value={activeFilter} onChange={setActiveFilter} options={activeOptions} /></Col>
      <Col><Select style={{ width: 200 }} value={effectiveStatus} onChange={setEffectiveStatus} options={effectiveOptions} /></Col>
    </>
  );
}

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
    <Card styles={{ body: { padding: 18 } }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Space size={8}>
          <FilterOutlined style={{ color: '#2563eb' }} />
          <Text strong>{t('adminCustomerNotifications.notification')}</Text>
          <Text type="secondary">{t('adminCustomerNotifications.searchPlaceholder')}</Text>
        </Space>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="auto">
            <Input
              size="large"
              prefix={<SearchOutlined />}
              placeholder={t('adminCustomerNotifications.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <FilterSelectors
            displayType={displayType}
            setDisplayType={setDisplayType}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            effectiveStatus={effectiveStatus}
            setEffectiveStatus={setEffectiveStatus}
            displayOptions={displayOptions}
            activeOptions={activeOptions}
            effectiveOptions={effectiveOptions}
          />
          <Col>
            <Space>
              <Button size="large" onClick={handleSearch}>{t('button.timKiem')}</Button>
              <Button size="large" icon={<ReloadOutlined />} onClick={resetFilters}>{t('button.datLai')}</Button>
            </Space>
          </Col>
          <Col>
            <Button size="large" type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('adminCustomerNotifications.add')}</Button>
          </Col>
        </Row>
      </div>
    </Card>
  );
}
