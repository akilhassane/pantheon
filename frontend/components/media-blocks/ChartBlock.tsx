'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';
import BlockContainer from '../blocks/BlockContainer';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ChartBlockData {
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'radar';
  data: any[];
  xKey?: string;
  yKeys?: string[];
  colors?: string[];
  title?: string;
}

interface ChartBlockProps {
  data: ChartBlockData;
  focused?: boolean;
  onClick?: () => void;
}

// Default neon colors for charts
const DEFAULT_COLORS = [
  '#00d9ff', // Neon blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#ec4899', // Pink
];

export default function ChartBlock({ data, focused, onClick }: ChartBlockProps) {
  const header = (
    <div className="flex items-center gap-2 w-full">
      <BarChart3 className="w-3.5 h-3.5 text-[#00d9ff]" />
      <span className="text-[11px] text-gray-400 uppercase">{data.type} Chart</span>
      {data.title && (
        <span className="text-[11px] text-gray-500 truncate flex-1">
          {data.title}
        </span>
      )}
    </div>
  );

  const colors = data.colors || DEFAULT_COLORS;

  const renderChart = () => {
    const commonProps = {
      data: data.data,
      margin: { top: 10, right: 30, left: 0, bottom: 0 },
    };

    switch (data.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#101218" />
            <XAxis dataKey={data.xKey || 'name'} stroke="#6b7280" style={{ fontSize: '10px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #101218', borderRadius: '4px' }}
              labelStyle={{ color: '#d1d5db', fontSize: '11px' }}
              itemStyle={{ color: '#d1d5db', fontSize: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
            {(data.yKeys || ['value']).map((key, index) => (
              <Bar key={key} dataKey={key} fill={colors[index % colors.length]} />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#101218" />
            <XAxis dataKey={data.xKey || 'name'} stroke="#6b7280" style={{ fontSize: '10px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #101218', borderRadius: '4px' }}
              labelStyle={{ color: '#d1d5db', fontSize: '11px' }}
              itemStyle={{ color: '#d1d5db', fontSize: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
            {(data.yKeys || ['value']).map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ fill: colors[index % colors.length], r: 3 }}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={(entry) => entry.name}
            >
              {data.data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #16171E', borderRadius: '4px' }}
              itemStyle={{ color: '#d1d5db', fontSize: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
          </PieChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#16171E" />
            <XAxis dataKey={data.xKey || 'name'} stroke="#6b7280" style={{ fontSize: '10px' }} />
            <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #16171E', borderRadius: '4px' }}
              labelStyle={{ color: '#d1d5db', fontSize: '11px' }}
              itemStyle={{ color: '#d1d5db', fontSize: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
            {(data.yKeys || ['value']).map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#101218" />
            <XAxis dataKey={data.xKey || 'x'} stroke="#6b7280" style={{ fontSize: '10px' }} />
            <YAxis dataKey={data.yKeys?.[0] || 'y'} stroke="#6b7280" style={{ fontSize: '10px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #101218', borderRadius: '4px' }}
              itemStyle={{ color: '#d1d5db', fontSize: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
            <Scatter name="Data" data={data.data} fill={colors[0]} />
          </ScatterChart>
        );

      case 'radar':
        return (
          <RadarChart {...commonProps} cx="50%" cy="50%" outerRadius="80%">
            <PolarGrid stroke="#101218" />
            <PolarAngleAxis dataKey={data.xKey || 'name'} stroke="#6b7280" style={{ fontSize: '10px' }} />
            <PolarRadiusAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #101218', borderRadius: '4px' }}
              itemStyle={{ color: '#d1d5db', fontSize: '10px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
            {(data.yKeys || ['value']).map((key, index) => (
              <Radar
                key={key}
                name={key}
                dataKey={key}
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
                fillOpacity={0.3}
              />
            ))}
          </RadarChart>
        );

      default:
        return <div className="text-gray-400 text-[11px] p-4">Unsupported chart type</div>;
    }
  };

  return (
    <BlockContainer
      type="mermaid"
      header={header}
      focused={focused}
      onClick={onClick}
    >
      <div className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </BlockContainer>
  );
}
