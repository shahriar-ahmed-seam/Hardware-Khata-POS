import { Navigate } from 'react-router-dom';

/** Dropped (owner decision 7): the Stock report and the Products list cover it. */
export default function ItemsReportPage() {
  return <Navigate to="/reports/stock" replace />;
}
