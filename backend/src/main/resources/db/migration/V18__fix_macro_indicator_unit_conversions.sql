UPDATE foreign_reserves
SET amount_usd_million = amount_usd_million / 1000
WHERE source LIKE 'ECOS:732Y001%';

UPDATE domestic_policy_indicators
SET value = value * 10
WHERE indicator_code = 'M2'
  AND unit = 'KRW_100M'
  AND source LIKE 'ECOS:161Y005%';
