import { Button, Card, Col, Input, Row, Select, Space } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button as MobileButton, Input as MobileInput, Selector, Space as MobileSpace } from 'antd-mobile';

function FilterSelectors({ displayType, setDisplayType, activeFilter, setActiveFilter, effectiveStatus, setEffectiveStatus, displayOptions, activeOptions, effectiveOptions }) {
  return (
    <>
      <Col><Select style={{ width: 160 }} value={displayType} onChange={setDisplayType} options={displayOptions} /></Col>
      <Col><Select style={{ width: 180 }} value={activeFilter} onChange={setActiveFilter} options={activeOptions} /></Col>
      <Col><Select style={{ width: 180 }} value={effectiveStatus} onChange={setEffectiveStatus} options={effectiveOptions} /></Col>
    </>
  );
}

function MobileFilterSelectors({ displayType, setDisplayType, activeFilter, setActiveFilter, effectiveStatus, setEffectiveStatus, displayOptions, activeOptions, effectiveOptions, t }) {
  return (
    <MobileSpace direction="vertical" block style={{ '--gap': '8px' }}>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--adm-color-weak)' }}>{t('adminCustomerNotifications.displayType')}</div>
        <Selector value={[displayType]} options={displayOptions.map((x) => ({ label: x.label, value: x.value }))} onChange={(arr) => setDisplayType(arr[0] ?? '')} />
      </div>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--adm-color-weak)' }}>{t('adminCustomerNotifications.activeStatus')}</div>
        <Selector value={[activeFilter]} options={activeOptions.map((x) => ({ label: x.label, value: x.value }))} onChange={(arr) => setActiveFilter(arr[0] ?? '')} />
      </div>
      <div>
        <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--adm-color-weak)' }}>{t('adminCustomerNotifications.allEffectiveStatus')}</div>
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
      <div style={{ display: 'grid', gap: 10 }}>
        <MobileInput
          placeholder={t('adminCustomerNotifications.searchPlaceholder')}
          value={search}
          onChange={setSearch}
          clearable
        />
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
        <MobileSpace wrap>
          <MobileButton size="small" onClick={handleSearch}>{t('button.timKiem')}</MobileButton>
          <MobileButton size="small" onClick={resetFilters}>{t('button.datLai')}</MobileButton>
          <MobileButton size="small" color="primary" onClick={openCreate}>+ {t('adminCustomerNotifications.add')}</MobileButton>
        </MobileSpace>
      </div>
    );
  }

  return (
    <Card>
      <Row gutter={12} align="middle">
        <Col flex="auto">
          <Input
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
            <Button onClick={handleSearch}>{t('button.timKiem')}</Button>
            <Button icon={<ReloadOutlined />} onClick={resetFilters}>{t('button.datLai')}</Button>
          </Space>
        </Col>
        <Col><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t('adminCustomerNotifications.add')}</Button></Col>
      </Row>
    </Card>
  );
}
