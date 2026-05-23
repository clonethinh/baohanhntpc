import { useState, useEffect } from 'react';
import { Row, Col, Card, Segmented, DatePicker, Empty } from 'antd';
import { Card as MobileCard, Grid as MobileGrid, Selector } from 'antd-mobile';
import { Bar, Column, Line } from '@ant-design/charts';
import { statsService } from '../../services/warrantyService';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const PERIODS = ['last7Days', 'last30Days', 'last90Days', 'thisYear', 'custom'];
const DEFAULT_PERIOD = 'last30Days';

export default function Statistics() {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [customRange, setCustomRange] = useState(null);
  const [byDateData, setByDateData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const getDateRange = () => {
    if (period === 'custom' && customRange) {
      return {
        from: customRange[0].format('YYYY-MM-DD'),
        to: customRange[1].format('YYYY-MM-DD'),
      };
    }

    const to = dayjs();
    let from;
    if (period === 'last7Days') from = to.subtract(7, 'day');
    else if (period === 'last30Days') from = to.subtract(30, 'day');
    else if (period === 'last90Days') from = to.subtract(90, 'day');
    else if (period === 'thisYear') from = to.startOf('year');
    else from = to.subtract(30, 'day');

    return { from: from.format('YYYY-MM-DD'), to: to.format('YYYY-MM-DD') };
  };

  useEffect(() => {
    setLoading(true);
    const range = getDateRange();
    Promise.all([
      statsService.byDate({ ...range, groupBy: period === 'last7Days' || period === 'last30Days' ? 'day' : 'week' }),
      statsService.topProducts({ limit: 10 }),
      statsService.topCustomers({ limit: 10 }),
    ]).then(([byDate, products, customers]) => {
      if (byDate.data.success) setByDateData(Array.isArray(byDate.data.data) ? byDate.data.data : []);
      if (products.data.success) setTopProducts(Array.isArray(products.data.data) ? products.data.data : []);
      if (customers.data.success) setTopCustomers(Array.isArray(customers.data.data) ? customers.data.data : []);
    }).finally(() => setLoading(false));
  }, [period, customRange]);

  const chartTheme = isDark ? 'classicDark' : 'classic';
  const totalTickets = byDateData.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const avgProcess = (() => {
    const values = byDateData.map(d => Number(d.avgProcessDays || 0)).filter(Boolean);
    if (!values.length) return 0;
    return Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 10) / 10;
  })();
  const ticketsByDate = byDateData
    .filter(item => item && item.date)
    .map(item => ({
      date: String(item.date),
      ticketCount: Number(item.count || 0),
      avgProcessDays: Number(item.avgProcessDays || 0),
    }));
  const topProductRows = topProducts
    .filter(item => item)
    .map(item => ({
      product: String(item.tenHang || t('common.khongCoDuLieu')),
      ticketCount: Number(item.count || 0),
    }))
    .filter(item => Number.isFinite(item.ticketCount))
    .sort((a, b) => b.ticketCount - a.ticketCount);
  const topCustomerRows = topCustomers
    .filter(item => item)
    .map(item => ({
      customer: String(item.khachHang || t('common.khongCoDuLieu')),
      ticketCount: Number(item.count || 0),
    }))
    .filter(item => Number.isFinite(item.ticketCount))
    .sort((a, b) => b.ticketCount - a.ticketCount);

  const columnConfig = {
    data: ticketsByDate,
    xField: 'date',
    yField: 'ticketCount',
    autoFit: true,
    theme: chartTheme,
    label: false,
    axis: {
      x: { title: t('adminStatistics.dateLabel') },
      y: { title: t('adminStatistics.ticketCountLabel') },
    },
    tooltip: {
      title: 'date',
      items: [{ field: 'ticketCount', name: t('adminStatistics.ticketCountLabel') }],
    },
  };

  const lineConfig = {
    data: ticketsByDate.filter(d => d.avgProcessDays > 0),
    xField: 'date',
    yField: 'avgProcessDays',
    autoFit: true,
    theme: chartTheme,
    smooth: true,
    axis: {
      x: { title: t('adminStatistics.dateLabel') },
      y: { title: t('adminStatistics.avgProcessDaysLabel') },
    },
    tooltip: {
      title: 'date',
      items: [{ field: 'avgProcessDays', name: t('adminStatistics.avgProcessDaysLabel') }],
    },
  };

  const topProductsConfig = {
    data: topProductRows,
    xField: 'ticketCount',
    yField: 'product',
    autoFit: true,
    theme: chartTheme,
    label: false,
    axis: {
      x: { title: t('adminStatistics.ticketCountLabel') },
      y: { title: false },
    },
    tooltip: {
      title: 'product',
      items: [{ field: 'ticketCount', name: t('adminStatistics.ticketCountLabel') }],
    },
  };

  const topCustomersConfig = {
    data: topCustomerRows,
    xField: 'ticketCount',
    yField: 'customer',
    autoFit: true,
    theme: chartTheme,
    label: false,
    axis: {
      x: { title: t('adminStatistics.ticketCountLabel') },
      y: { title: false },
    },
    tooltip: {
      title: 'customer',
      items: [{ field: 'ticketCount', name: t('adminStatistics.ticketCountLabel') }],
    },
  };

  const periodOptions = PERIODS.map(value => ({ label: t(`adminStatistics.period.${value}`), value }));
  const empty = <Empty description={t('common.khongCoDuLieu')} />;

  return (
    <>
      <div className="mobile-only admin-mobile-page statistics-mobile-page">
        <MobileCard className="admin-mobile-card" title={t('adminStatistics.title')}>
          <Selector
            value={[period]}
            onChange={arr => setPeriod(arr[0] || DEFAULT_PERIOD)}
            options={periodOptions}
          />
          {period === 'custom' && (
            <div className="statistics-mobile-range">
              <RangePicker value={customRange} onChange={setCustomRange} />
            </div>
          )}
        </MobileCard>

        <MobileGrid columns={2} gap={8}>
          <MobileGrid.Item><div className="admin-mobile-kpi"><span>{t('adminStatistics.totalTickets')}</span><b>{totalTickets}</b></div></MobileGrid.Item>
          <MobileGrid.Item><div className="admin-mobile-kpi"><span>{t('adminStatistics.avgProcess')}</span><b>{avgProcess}</b></div></MobileGrid.Item>
          <MobileGrid.Item><div className="admin-mobile-kpi success"><span>{t('adminStatistics.topProducts')}</span><b>{topProducts.length}</b></div></MobileGrid.Item>
          <MobileGrid.Item><div className="admin-mobile-kpi warn"><span>{t('adminStatistics.topCustomers')}</span><b>{topCustomers.length}</b></div></MobileGrid.Item>
        </MobileGrid>

        <MobileCard className="admin-mobile-card statistics-mobile-chart" title={t('adminStatistics.ticketsByTime')}>
          {loading ? t('adminStatistics.loading') : byDateData.length === 0 ? t('common.khongCoDuLieu') : <Column {...columnConfig} />}
        </MobileCard>

        <MobileCard className="admin-mobile-card statistics-mobile-chart" title={t('adminStatistics.avgProcessTime')}>
          {loading ? t('adminStatistics.loading') : byDateData.filter(d => d.avgProcessDays > 0).length === 0 ? t('common.khongCoDuLieu') : <Line {...lineConfig} />}
        </MobileCard>

        <MobileCard className="admin-mobile-card statistics-mobile-chart" title={t('adminStatistics.topWarrantyProducts')}>
          {loading ? t('adminStatistics.loading') : topProducts.length === 0 ? t('common.khongCoDuLieu') : <Bar {...topProductsConfig} />}
        </MobileCard>

        <MobileCard className="admin-mobile-card statistics-mobile-chart" title={t('adminStatistics.topWarrantyCustomers')}>
          {loading ? t('adminStatistics.loading') : topCustomers.length === 0 ? t('common.khongCoDuLieu') : <Bar {...topCustomersConfig} />}
        </MobileCard>
      </div>

      <div className="desktop-only">
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col>
            <Segmented value={period} onChange={setPeriod} options={periodOptions} />
          </Col>
          {period === 'custom' && (
            <Col>
              <RangePicker value={customRange} onChange={setCustomRange} />
            </Col>
          )}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title={t('adminStatistics.ticketsByTime')} loading={loading}>
              {byDateData.length === 0 ? empty : <Column {...columnConfig} />}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={t('adminStatistics.avgProcessTime')} loading={loading}>
              {byDateData.filter(d => d.avgProcessDays > 0).length === 0 ? empty : <Line {...lineConfig} />}
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={t('adminStatistics.top10WarrantyProducts')} loading={loading}>
              {topProducts.length === 0 ? empty : <Bar {...topProductsConfig} />}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={t('adminStatistics.top10WarrantyCustomers')} loading={loading}>
              {topCustomers.length === 0 ? empty : <Bar {...topCustomersConfig} />}
            </Card>
          </Col>
        </Row>
      </div>
    </>
  );
}
