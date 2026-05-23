import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button, Spin, Result } from 'antd';
import { PrinterOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { supplierService, warrantyService } from '../../services/warrantyService';
import { formatDate, shouldShowDueDate } from '../../utils/dateHelpers';
import { formatVND } from '../../utils/formatters';
import { LOAI_XU_LY_LABELS } from '../../constants/warrantyOptions';

export default function WarrantyPrint() {
  const { t } = useTranslation('print');
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get('new') === '1';
  const printType = searchParams.get('type');
  const [warranty, setWarranty] = useState(null);
  const [supplierLogs, setSupplierLogs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: warranty?.soChungTu || (warranty?.loaiPhieu === 'bien_nhan' ? 'bien-nhan' : 'phieu-bao-hanh'),
  });

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      warrantyService.getById(id),
      warrantyService.getSupplierLogs(id),
      supplierService.getList({ pageSize: 1000 }),
    ])
      .then(([warrantyRes, logsRes, suppliersRes]) => {
        if (!mounted) return;
        if (warrantyRes.status === 'fulfilled' && warrantyRes.value.data.success) setWarranty(warrantyRes.value.data.data);
        if (logsRes.status === 'fulfilled' && logsRes.value.data.success) setSupplierLogs(logsRes.value.data.data || []);
        if (suppliersRes.status === 'fulfilled' && suppliersRes.value.data.success) setSuppliers(suppliersRes.value.data.data?.rows || suppliersRes.value.data.data || []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (autoPrint && warranty && printRef.current) {
      setTimeout(() => {
        handlePrint();
      }, 500);
    }
  }, [autoPrint, warranty, handlePrint]);

  useEffect(() => {
    const fitSerial = () => {
      printRef.current?.querySelectorAll?.('.ncc-serial-cell .ncc-serial').forEach((el) => {
        const cell = el.closest('.ncc-serial-cell');
        if (!cell) return;
        el.style.transform = '';
        const available = cell.clientWidth - 10;
        if (el.scrollWidth > available && el.scrollWidth > 0) {
          el.style.transform = `scaleX(${Math.max(0.65, available / el.scrollWidth)})`;
        }
      });
    };
    fitSerial();
    window.addEventListener('resize', fitSerial);
    window.addEventListener('beforeprint', fitSerial);
    return () => {
      window.removeEventListener('resize', fitSerial);
      window.removeEventListener('beforeprint', fitSerial);
    };
  }, [warranty, supplierLogs]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;
  if (!warranty) return <Result status="404" title={t('notFound')} />;

  const trackingUrl = `${window.location.origin}/tra-cuu/${warranty.soChungTu}`;
  const latestSentLog = supplierLogs
    .filter((log) => log.action === 'sent')
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())[0] || supplierLogs[0];
  const supplier = suppliers.find((item) => item.id === latestSentLog?.supplierId);
  const supplierInfo = latestSentLog ? {
    name: supplier?.name || latestSentLog?.supplierName || 'Nhà cung cấp',
    phone: supplier?.phone || '',
    address: supplier?.address || '',
    note: latestSentLog?.note || '',
  } : null;
  const supplierTotal = 1;

  if (printType === 'supplier' && supplierInfo) {
    return (
      <div>
        <div className="no-print" style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}>{t('back')}</Button>
          <Button type="primary" icon={<PrinterOutlined />} style={{ marginLeft: 8 }} onClick={handlePrint}>{t('print')}</Button>
        </div>

        <div ref={printRef} className="ncc-print-page">
          <style>{`
            :root { --a4-width: 210mm; --half-a4-height: 148.5mm; }
            .ncc-print-page {
              width: var(--a4-width);
              height: var(--half-a4-height);
              margin: 0 auto;
              padding: 10mm 7mm;
              background: #fff;
              color: #000;
              position: relative;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              font-family: Tahoma, 'Segoe UI', Arial, 'Helvetica Neue', sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              box-shadow: 0 4px 15px rgba(0,0,0,.15);
            }
            .ncc-cut-line { position: absolute; bottom: 0; left: 0; width: 100%; border-bottom: 1px dashed #999; }
            .ncc-logo { width: 80px; height: auto; max-height: 40px; object-fit: contain; filter: grayscale(1) contrast(1.35); }
            .ncc-company { font-weight: 900; font-size: 13px; text-transform: uppercase; margin-bottom: 3px; line-height: 1.2; }
            .ncc-company-sub { font-size: 10px; line-height: 1.5; font-weight: 600; }
            .ncc-title { display: inline-block; margin: 0; font-weight: 900; font-size: 15px; text-transform: uppercase; padding: 3px 20px; }
            .ncc-info-value { padding: 5px 8px; border-right: 1px solid #000; font-size: 11px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
            .ncc-info-value:last-child { border-right: none; }
            .ncc-info-label { display: block; font-size: 8px; font-weight: 900; text-transform: uppercase; color: #444; margin-bottom: 2px; }
            .ncc-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 5px; font-size: 11px; color: #000; }
            .ncc-table th { background: #f8f8f8; font-weight: 900; font-size: 10px; text-transform: uppercase; padding: 5px 4px; border: 1px solid #000; text-align: center; }
            .ncc-table td { border: 1px solid #000; padding: 5px; vertical-align: middle; font-weight: 600; word-break: break-word; }
            .ncc-table td:nth-child(2) { font-weight: 800; }
            .ncc-serial-cell { white-space: nowrap; overflow: hidden; }
            .ncc-serial { font-family: Consolas, monospace; font-size: 10px; display: inline-block; font-weight: 800; transform-origin: left center; white-space: nowrap; }
            .ncc-note-cell { font-size: 10.2px; line-height: 1.28; overflow-wrap: anywhere; word-break: break-word; }
            .ncc-note-text { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
            .ncc-total td { border-top: 2px solid #000 !important; font-weight: 900; font-size: 11px; text-transform: uppercase; }
            .ncc-signs { display: flex; justify-content: space-around; margin-top: auto; padding-top: 10px; }
            .ncc-sign { text-align: center; padding-bottom: 30px; }
            .ncc-sign-title { font-weight: 900; font-size: 11px; text-transform: uppercase; }
            .ncc-sign-sub { font-size: 9px; font-style: italic; font-weight: 600; margin-top: 3px; }
            @media print {
              body { background: #fff !important; padding: 0 !important; margin: 0 !important; }
              .no-print { display: none !important; }
              .ncc-print-page { box-shadow: none; border: none; width: var(--a4-width); height: var(--half-a4-height); }
              .ncc-cut-line { border-bottom: 1px dashed #ccc; }
              @page { size: A4 portrait; margin: 0; }
            }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, paddingBottom: 7, borderBottom: '2px solid #000', marginBottom: 7 }}>
            <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
              <img className="ncc-logo" src="/logo.png" alt="Logo" style={{ width: 82, height: 36, objectFit: 'contain', flexShrink: 0 }} />
              <div>
                <div className="ncc-company">{t('company')}</div>
                <div className="ncc-company-sub">{t('address')}<br />ĐT/Zalo: {t('taxInfo')}<br />Website: https://nguyentanpc.com/<br />Fanpage: https://www.fb.com/vitinhnguyentan.vn</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 8.8, fontWeight: 600 }}>
              <div>Ngày in: <strong>{formatDate(new Date(), 'DD/MM/YYYY HH:mm')}</strong></div>
              <div style={{ marginTop: 5, fontSize: 7.5, fontWeight: 900, textTransform: 'uppercase' }}>Số chứng từ</div>
              <div style={{ fontFamily: 'Consolas, monospace', fontSize: 12, fontWeight: 800 }}>{warranty.soChungTu}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '5px 0 6px' }}>
            <h1 className="ncc-title">PHIẾU GỬI BẢO HÀNH - SỬA CHỮA</h1>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr 1.5fr', border: '1px solid #000', marginBottom: 8 }}>
            <div className="ncc-info-value"><span className="ncc-info-label">Nhà cung cấp</span>{supplierInfo.name}</div>
            <div className="ncc-info-value"><span className="ncc-info-label">Điện thoại</span>{supplierInfo.phone || '—'}</div>
            <div className="ncc-info-value"><span className="ncc-info-label">Địa chỉ</span>{supplierInfo.address || '—'}</div>
          </div>

          <table className="ncc-table">
            <thead>
              <tr><th style={{ width: 28 }}>STT</th><th>Tên Hàng Hóa / Linh Kiện</th><th style={{ width: 120 }}>Số Seri</th><th>Mô Tả Lỗi</th><th style={{ width: 95 }}>Ghi Chú</th><th style={{ width: 28 }}>SL</th></tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center' }}>1</td>
                <td>{warranty.tenHang || '-'}</td>
                <td className="ncc-serial-cell"><span className="ncc-serial">{warranty.soSeri || '-'}</span></td>
                <td>{warranty.loiLucNhan || '-'}</td>
                <td className="ncc-note-cell"><span className="ncc-note-text">{supplierInfo.note || warranty.ghiChu || '-'}</span></td>
                <td style={{ textAlign: 'center' }}>1</td>
              </tr>
              {Array.from({ length: 4 }).map((_, index) => <tr key={index}><td style={{ textAlign: 'center' }}>{index + 2}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>)}
              <tr className="ncc-total"><td colSpan={5} style={{ textAlign: 'right', paddingRight: 15 }}>Tổng số lượng nhận:</td><td style={{ textAlign: 'center' }}>{supplierTotal}</td></tr>
            </tbody>
          </table>

          <div className="ncc-signs">
            <div className="ncc-sign"><div className="ncc-sign-title">Khách Hàng</div><div className="ncc-sign-sub">(Ký, ghi rõ họ tên)</div></div>
            <div className="ncc-sign"><div className="ncc-sign-title">Người Lập Phiếu</div><div className="ncc-sign-sub">(Ký, ghi rõ họ tên)</div></div>
          </div>
          <div className="ncc-cut-line" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}>{t('back')}</Button>
        <Button type="primary" icon={<PrinterOutlined />} style={{ marginLeft: 8 }} onClick={handlePrint}>
          {t('print')}
        </Button>
      </div>

      <div ref={printRef} style={{ maxWidth: 700, margin: '0 auto', padding: 20, fontFamily: 'Arial, sans-serif', fontSize: 13 }}>
        <div style={{ borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 15 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 16 }}>{t('company')}</strong>
            <div style={{ fontSize: 12 }}>{t('address')}</div>
            <div style={{ fontSize: 12 }}>{t('taxInfo')}</div>
            <div style={{ fontSize: 12 }}>{t('webInfo')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ fontSize: 18 }}>{warranty.loaiPhieu === 'bien_nhan' ? t('receiptTitle') : t('warrantyReceiveTitle')}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div>{t('documentNumber')}: <strong>{warranty.soChungTu}</strong></div>
            <div>{t('date')}: {(() => {
              const d = warranty.ngayNhan;
              if (!d) return '';
              const formatted = formatDate(d, 'DD/MM/YYYY HH:mm');
              return formatted.endsWith('00:00') ? formatDate(d, 'DD/MM/YYYY') : formatted;
            })()}</div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '0 0 8px 0' }}>{t('customerSection')}</h3>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>{t('customerName')}: <strong>{warranty.khachHang}</strong></div>
            <div>{t('phone')}: {warranty.soDienThoai || '-'}</div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '0 0 8px 0' }}>{t('productSection')}</h3>
          <div>{t('productName')}: <strong>{warranty.tenHang}</strong></div>
          <div>{t('serial')}: {warranty.soSeri}</div>
          <div>{t('config')}: {warranty.cauHinh || '-'}</div>
          <div>{t('receivedIssue')}: {warranty.loiLucNhan}</div>
          <div>{t('accessories')}: {warranty.phuKien || '-'}</div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: 4, margin: '0 0 8px 0' }}>{t('warrantySection')}</h3>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              {t('warrantyTerm')}: {warranty.baoHanh}
              {warranty.loaiPhieu === 'bien_nhan' ? <div>{t('fromReturnDate')}</div> : null}
            </div>
            <div>{t('purchaseDate')}: {formatDate(warranty.ngayMua)}</div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>{t('handlingType')}: {LOAI_XU_LY_LABELS[warranty.loaiXuLy] || warranty.loaiXuLy}</div>
            <div>
              {t('cost')}: {warranty.loaiPhieu === 'bien_nhan' && warranty.baoGiaSau ? t('quoteLater') : formatVND(warranty.chiPhi)}
            </div>
          </div>
          {shouldShowDueDate(warranty) && <div>{t('dueDate')}: <strong>{formatDate(warranty.ngayHenTra)}</strong></div>}
          {warranty.ghiChu && <div>{t('note')}: {warranty.ghiChu}</div>}
        </div>

        <div style={{ marginBottom: 12, borderTop: '1px solid #ccc', paddingTop: 10 }}>
          <h3 style={{ margin: '0 0 8px 0' }}>{t('onlineLookupSection')}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
            <QRCodeSVG value={trackingUrl} size={113} level="M" />
            <div>
              <div style={{ fontSize: 11, color: '#666' }}>{trackingUrl}</div>
              <div style={{ fontSize: 11, color: '#666', fontStyle: 'italic' }}>{t('scanQr')}</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 50 }}>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <strong>{t('receiver')}</strong>
            <div style={{ marginTop: 60, borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>{t('signatureNote')}</div>
          </div>
          <div style={{ textAlign: 'center', width: '45%' }}>
            <strong>{t('customerConfirm')}</strong>
            <div style={{ marginTop: 60, borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }}></div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>{t('signatureNote')}</div>
          </div>
        </div>

        <div style={{ marginTop: 20, borderTop: '1px dashed #ccc', paddingTop: 10, fontSize: 11, color: '#666' }}>
          <div style={{ marginBottom: 4 }}>{t('policyLink')}</div>
          <div style={{ marginBottom: 4 }}>{t('deliveryNote')}</div>
          <div style={{ marginBottom: 4 }}>{t('storageNote')}</div>
        </div>
      </div>
    </div>
  );
}
