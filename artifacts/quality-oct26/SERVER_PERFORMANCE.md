# Final authoritative performance checks

Server simulation/network measurements, separate from native client rendering. Existing limits and gameplay conditions are unchanged.

|BR players|Identity offset|Average ms|p95 ms|Worst ms|Max snapshot bytes|
|---:|---:|---:|---:|---:|---:|
|10|0|1.519|2.887|48.831|12024|
|20|0|2.916|5.471|10.204|20577|
|40|0|7.412|13.082|19.720|37586|
|40|1000|7.458|12.176|17.833|37609|
|40|5000|7.889|13.605|25.020|37553|

BR budgets: average<16ms,p95<45ms,worst<150ms,snapshot<160000bytes.

|PG pilots|Average ms|p95 ms|Worst ms|Max snapshot bytes|Shots|Kills|
|---:|---:|---:|---:|---:|---:|---:|
|4|0.452|0.910|4.318|6303|105|18|
|8|0.775|1.395|2.857|11401|280|43|
|12|1.292|2.299|5.079|16506|464|72|

PG budgets: average<8ms,p95<16ms,snapshot<40000bytes; active movement,>25shots and at least one kill required. All passed in the1682-test final unit run. Raw JSON/logs are under validation/.