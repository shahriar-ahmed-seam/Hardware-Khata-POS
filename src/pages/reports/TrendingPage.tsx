import { Navigate } from 'react-router-dom';

/** Folded into Sales by product (owner decision 7): "Compare with previous period". */
export default function TrendingPage() {
  return <Navigate to="/reports/product-sell?compare=1" replace />;
}
