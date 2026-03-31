import { LineChart, Line, ResponsiveContainer } from 'recharts';

const SparklineChart = ({ data, color = '#2563EB' }) => (
  <ResponsiveContainer width="100%" height={40}>
    <LineChart data={data}>
      <Line 
        type="monotone" 
        dataKey="value" 
        stroke={color} 
        strokeWidth={2}
        dot={false} 
        connectNulls={true}
      />
    </LineChart>
  </ResponsiveContainer>
);

export default SparklineChart;
