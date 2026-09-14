import Card from '@/components/Card';
import ScanForm from './ScanForm';

export default function ScanPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">掃描收件</h1>
      <p className="mb-6 text-muted-fg">游標會停在輸入框，掃描申請表右上角條碼會自動送出，不需碰滑鼠。</p>
      <Card><ScanForm /></Card>
    </>
  );
}
