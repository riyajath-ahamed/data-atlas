# Bundled sample

The app reads a local World Bank sample. It does not call the World Bank, Natural Earth, or any other remote service while it is running. `scripts/fetch-sample-data.mjs` is the one-shot download used to refresh the files under `src/data/datasets/`.

Retrieved 12 October 2026.

## Observations

`observations.csv` has 7,595 country-year rows for 217 World Bank economies, years 1990 through 2024. There are no duplicate country-year keys. Empty cells stay missing. They are not stored or drawn as zero. A published zero, such as an internet-use rate of 0, is kept as zero.

| Field | World Bank series | Unit |
| --- | --- | --- |
| Population | `SP.POP.TOTL` | people |
| GDP per capita | `NY.GDP.PCAP.CD` | current US$ |
| Life expectancy | `SP.DYN.LE00.IN` | years |
| Internet use | `IT.NET.USER.ZS` | % of population |
| CO2 per capita | `EN.GHG.CO2.PC.CE.AR5` | t CO2e per capita, excluding LULUCF |
| Renewable energy | `EG.FEC.RNEW.ZS` | % of total final energy consumption |

`EN.ATM.CO2E.PC` (older fossil-fuel CO2 per capita) is archived at the Bank and is not in this file. The bundled CO2 series is the current WDI greenhouse-gas series excluding land use.

The default year is 2024, the latest year in the file, chosen because life expectancy is published for at least 120 countries. Coverage for 2024, out of 217 economies:

| Indicator | Missing in 2024 |
| --- | --- |
| Population | 0 |
| Life expectancy | 0 |
| CO2 per capita | 14 |
| GDP per capita | 17 |
| Internet use | 35 |
| Renewable energy | 217 |

Renewable energy has no 2024 observations in this download. Earlier years do. The choropleth and scatter leave those countries unmarked.

A checked row, United States 2019: population 330,226,227; GDP per capita 65,227.96 current US$; life expectancy 78.79 years; internet use 89.43%; CO2 15.04 t CO2e per capita; renewable energy 10.2%.

## Geography

`countries-110m.json` is Natural Earth 1:110m cultural countries from `world-atlas` 2.0.2. Shapes are joined to World Bank economies by ISO 3166-1 numeric code (`Number(isoNumeric)`). Countries without a value stay missing on the map. They are not filled as zero.

Eight geometry ids do not match a World Bank economy: 732, 238, 260, 158 (Taiwan), 010 (Antarctica), and three geometries without an id. Forty-eight World Bank economies have no 110m polygon, mostly small islands and territories. They remain in the table, scatter, timeline, and treemap. They do not appear as map areas.

Shared borders come only from `topojson.neighbors` on that topology. The relationship view labels those links as geographic adjacency. There is no trade or other edge list.

## Hierarchy

The treemap groups economies by the World Bank region on the country record, then by country. The current region name for that group is “Middle East, North Africa, Afghanistan & Pakistan”.

## Synthetic rows

`src/engine/benchmarks/synthetic.ts` builds a labeled synthetic table for timing only. Those rows are not shown in the explorer.
