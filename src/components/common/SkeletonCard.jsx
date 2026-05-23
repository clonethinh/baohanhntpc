import { Skeleton, Card } from 'antd';

export default function SkeletonCard() {
  return (
    <Card style={{ marginBottom: 16 }}>
      <Skeleton active paragraph={{ rows: 4 }} />
    </Card>
  );
}
