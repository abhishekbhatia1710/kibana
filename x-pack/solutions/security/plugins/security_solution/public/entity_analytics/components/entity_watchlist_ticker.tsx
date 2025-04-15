/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React, { useEffect, useState } from 'react';
import { EuiHealth, EuiText, EuiIcon } from '@elastic/eui';
import { useKibana } from '../../common/lib/kibana/kibana_react';

interface WatchlistItem {
  id: string;
  entity_id: string;
  entity_type: string;
  risk_score: number;
  risk_score_change?: number;
  last_updated: string;
}

export const RiskTicker: React.FC = () => {
  const { http } = useKibana().services;
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const fetchWatchlist = async () => {
      try {
        const res = await http.get('/api/entity_analytics/entity/watchlist');
        setWatchlist(res.watchlist);
      } catch (e) {
        console.error('Error fetching watchlist:', e);
      }
    };

    fetchWatchlist();
    const interval = setInterval(fetchWatchlist, 10000);

    return () => clearInterval(interval);
  }, [http]);

  const renderItem = (item: WatchlistItem) => {
    const isPositive = item.risk_score_change !== undefined && item.risk_score_change < 0;
    const color = isPositive ? 'success' : 'danger';
    const arrowIcon = isPositive ? 'sortDown' : 'sortUp';
    const entityIcon =
      item.entity_type === 'user'
        ? 'user'
        : item.entity_type === 'host'
        ? 'compute'
        : 'package';
    const label = `${item.entity_id} (${item.risk_score})`;

    return (
      <div key={`${item.id}-${Math.random()}`} style={{ minWidth: 200, marginRight: 40 }}>
        <EuiHealth color={color}>
          <EuiText size="s">
            <EuiIcon type={entityIcon} size="s" css={{ marginRight: 4 }} />
            {label}
            <EuiIcon
              type={arrowIcon}
              color={color}
              size="s"
              css={{ marginLeft: 6, verticalAlign: 'middle' }}
            />
          </EuiText>
        </EuiHealth>
      </div>
    );
  };

  const itemsToRender = [...watchlist, ...watchlist]; // duplicate for infinite scroll illusion

  return (
    <div
      style={{
        overflow: 'hidden',
        width: '100%',
        background: '#f5f7fa',
        position: 'relative',
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        style={{
          display: 'inline-flex',
          whiteSpace: 'nowrap',
          animation: 'ticker-scroll 40s linear infinite',
          animationPlayState: isPaused ? 'paused' : 'running',
        }}
      >
        {itemsToRender.map(renderItem)}
      </div>

      <style>
        {`
          @keyframes ticker-scroll {
            0% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(-50%);
            }
          }
        `}
      </style>
    </div>
  );
};

export default RiskTicker;
