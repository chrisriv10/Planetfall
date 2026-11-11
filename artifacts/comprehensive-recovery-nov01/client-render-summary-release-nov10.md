# Client rendering — final November10 run

All20normalmatch cases and16syntheticrendercases passed on RTX3060 D3D11 at1280×720. Normal matches use12pilots or4survivors; bots and effects are live and not frozen. Auto uses the real setting in normal matches. Frame intervals are display-capped; no uncapped FPS gain is claimed. CPU figures measure JavaScript frame work, not GPU elapsed time.

| Mode | Preset | View | Frame median/p95 ms | CPU median/p95 ms | Calls | Triangles | Instances | Materials |
|---|---|---|---|---|---|---|---|---|
| deathmatch | auto→medium | crowd6 | 16.7/16.8 | 3.10/5.40 | 125 | 72916 | 3803 | 71 |
| deathmatch | auto→medium | crowd6-unbatched | 16.7/16.8 | 3.50/5.20 | 246 | 69686 | 3641 | 130 |
| deathmatch | auto→medium | overhead | 16.7/16.8 | 2.90/4.90 | 111 | 72162 | 3725 | 65 |
| deathmatch | auto→medium | westInterior | 16.7/16.8 | 3.20/5.00 | 140 | 79858 | 3785 | 72 |
| deathmatch | high→high | crowd6 | 16.7/16.8 | 3.30/5.60 | 112 | 74912 | 3843 | 72 |
| deathmatch | high→high | crowd6-unbatched | 16.7/16.8 | 3.20/5.80 | 84 | 56246 | 3623 | 120 |
| deathmatch | high→high | overhead | 16.7/16.8 | 2.90/3.90 | 120 | 72830 | 3707 | 72 |
| deathmatch | high→high | westInterior | 16.7/16.8 | 3.30/5.00 | 137 | 76676 | 3671 | 71 |
| deathmatch | low→low | crowd6 | 16.7/16.8 | 3.30/5.10 | 96 | 54780 | 3137 | 71 |
| deathmatch | low→low | crowd6-unbatched | 16.7/16.8 | 3.70/6.00 | 176 | 51628 | 2998 | 117 |
| deathmatch | low→low | overhead | 16.7/16.8 | 2.90/4.50 | 109 | 62298 | 3086 | 71 |
| deathmatch | low→low | westInterior | 16.7/16.8 | 3.20/4.90 | 116 | 64136 | 3086 | 71 |
| deathmatch | medium→medium | crowd6 | 16.7/16.8 | 3.20/5.80 | 105 | 71126 | 3759 | 72 |
| deathmatch | medium→medium | crowd6-unbatched | 16.7/16.8 | 3.20/4.70 | 146 | 65472 | 3605 | 121 |
| deathmatch | medium→medium | overhead | 16.7/16.8 | 3.20/5.30 | 139 | 73342 | 3741 | 65 |
| deathmatch | medium→medium | westInterior | 16.7/16.8 | 3.20/5.00 | 141 | 83274 | 3804 | 72 |
| planetsiege | auto→medium | crowd6 | 16.7/16.8 | 4.90/7.60 | 140 | 58754 | 3615 | 164 |
| planetsiege | auto→medium | crowd6-unbatched | 16.7/16.8 | 5.40/8.10 | 193 | 58754 | 3535 | 192 |
| planetsiege | auto→medium | overhead | 16.7/16.8 | 5.00/7.20 | 238 | 79978 | 3758 | 167 |
| planetsiege | auto→medium | westInterior | 16.7/16.8 | 4.60/6.30 | 202 | 76852 | 3753 | 168 |
| planetsiege | high→high | crowd6 | 16.7/16.8 | 5.90/10.20 | 216 | 86776 | 3848 | 160 |
| planetsiege | high→high | crowd6-unbatched | 16.7/16.8 | 5.80/7.70 | 279 | 71788 | 3571 | 263 |
| planetsiege | high→high | overhead | 16.7/16.9 | 5.60/9.10 | 245 | 82696 | 3758 | 177 |
| planetsiege | high→high | westInterior | 16.7/16.8 | 6.00/9.60 | 205 | 77616 | 3722 | 181 |
| planetsiege | low→low | crowd6 | 16.7/16.8 | 5.00/7.10 | 134 | 50990 | 2994 | 176 |
| planetsiege | low→low | crowd6-unbatched | 16.7/16.8 | 6.00/9.10 | 187 | 50990 | 2914 | 204 |
| planetsiege | low→low | overhead | 16.7/16.8 | 6.50/10.10 | 219 | 70390 | 3137 | 177 |
| planetsiege | low→low | westInterior | 16.7/16.8 | 5.00/7.80 | 179 | 65904 | 3090 | 180 |
| planetsiege | medium→medium | crowd6 | 16.7/16.8 | 4.90/7.70 | 194 | 71410 | 3794 | 160 |
| planetsiege | medium→medium | crowd6-unbatched | 16.7/16.8 | 6.00/9.80 | 254 | 71410 | 3655 | 227 |
| planetsiege | medium→medium | overhead | 16.7/16.8 | 4.50/5.80 | 239 | 79970 | 3758 | 167 |
| planetsiege | medium→medium | westInterior | 16.7/16.8 | 4.90/7.00 | 169 | 68492 | 3619 | 171 |
| planetstrike | auto→medium | crowd6 | 16.7/16.8 | 3.50/5.40 | 134 | 71434 | 3732 | 75 |
| planetstrike | auto→medium | crowd6-unbatched | 16.7/16.8 | 3.80/6.00 | 138 | 66296 | 3587 | 100 |
| planetstrike | auto→medium | overhead | 16.7/16.8 | 3.00/4.10 | 115 | 72534 | 3725 | 76 |
| planetstrike | auto→medium | westInterior | 16.7/16.8 | 3.30/5.10 | 146 | 84052 | 3804 | 76 |
| planetstrike | high→high | crowd6 | 16.7/16.8 | 3.80/5.60 | 131 | 79378 | 3802 | 76 |
| planetstrike | high→high | crowd6-unbatched | 16.7/16.8 | 3.80/5.10 | 139 | 62960 | 3557 | 108 |
| planetstrike | high→high | overhead | 16.7/16.8 | 3.30/5.60 | 123 | 74118 | 3725 | 76 |
| planetstrike | high→high | westInterior | 16.7/16.8 | 3.80/6.90 | 157 | 87218 | 3791 | 76 |
| planetstrike | low→low | crowd6 | 16.7/16.8 | 3.20/4.80 | 125 | 61804 | 3106 | 74 |
| planetstrike | low→low | crowd6-unbatched | 16.7/16.8 | 4.10/6.40 | 129 | 58076 | 2966 | 98 |
| planetstrike | low→low | overhead | 16.7/16.8 | 3.40/5.00 | 104 | 63546 | 3104 | 75 |
| planetstrike | low→low | westInterior | 16.7/16.9 | 3.20/4.60 | 130 | 70066 | 3142 | 75 |
| planetstrike | medium→medium | crowd6 | 16.7/16.8 | 3.60/5.60 | 105 | 73552 | 3732 | 75 |
| planetstrike | medium→medium | crowd6-unbatched | 16.7/16.8 | 4.00/6.10 | 191 | 71434 | 3573 | 117 |
| planetstrike | medium→medium | overhead | 16.7/16.9 | 3.00/4.20 | 114 | 72534 | 3725 | 76 |
| planetstrike | medium→medium | westInterior | 16.7/16.8 | 3.30/5.50 | 144 | 83206 | 3807 | 76 |
| planetwatch | auto→medium | crowd6 | 16.7/16.8 | 5.60/9.50 | 187 | 62672 | 3724 | 195 |
| planetwatch | auto→medium | crowd6-unbatched | 16.7/16.8 | 6.90/10.90 | 447 | 75744 | 3567 | 356 |
| planetwatch | auto→medium | overhead | 16.7/16.8 | 5.90/8.80 | 278 | 94318 | 3881 | 206 |
| planetwatch | auto→medium | westInterior | 16.7/16.8 | 5.90/8.90 | 244 | 85676 | 3817 | 199 |
| planetwatch | high→high | crowd6 | 16.7/16.8 | 6.10/8.80 | 251 | 94142 | 3949 | 196 |
| planetwatch | high→high | crowd6-unbatched | 16.7/16.8 | 6.90/9.90 | 161 | 65210 | 3567 | 355 |
| planetwatch | high→high | overhead | 16.7/16.8 | 6.60/10.20 | 317 | 100112 | 3881 | 206 |
| planetwatch | high→high | westInterior | 16.7/16.8 | 7.10/11.10 | 276 | 94256 | 3884 | 197 |
| planetwatch | low→low | crowd6 | 16.7/16.8 | 5.70/8.70 | 200 | 58748 | 3139 | 192 |
| planetwatch | low→low | crowd6-unbatched | 16.7/16.8 | 6.70/9.20 | 295 | 57666 | 2942 | 331 |
| planetwatch | low→low | overhead | 16.7/16.8 | 6.60/10.70 | 266 | 85322 | 3260 | 206 |
| planetwatch | low→low | westInterior | 16.7/16.8 | 6.10/9.70 | 238 | 75174 | 3163 | 199 |
| planetwatch | medium→medium | crowd6 | 16.7/16.8 | 5.50/8.30 | 148 | 55776 | 3608 | 193 |
| planetwatch | medium→medium | crowd6-unbatched | 16.7/16.8 | 6.50/10.10 | 260 | 62744 | 3563 | 334 |
| planetwatch | medium→medium | overhead | 16.7/16.8 | 5.70/7.50 | 268 | 93902 | 3881 | 204 |
| planetwatch | medium→medium | westInterior | 16.7/16.8 | 6.40/10.50 | 244 | 83440 | 3819 | 198 |
| planetzombies | auto→medium | crowd6 | 16.7/16.8 | 4.00/6.40 | 210 | 66228 | 3799 | 153 |
| planetzombies | auto→medium | crowd6-unbatched | 16.7/16.8 | 4.20/6.30 | 211 | 60080 | 3687 | 196 |
| planetzombies | auto→medium | overhead | 16.7/16.8 | 4.00/5.70 | 270 | 90772 | 3767 | 144 |
| planetzombies | auto→medium | westInterior | 16.7/16.8 | 3.80/5.70 | 207 | 79526 | 3771 | 144 |
| planetzombies | high→high | crowd6 | 16.7/16.8 | 4.20/6.20 | 222 | 69258 | 3799 | 153 |
| planetzombies | high→high | crowd6-unbatched | 16.7/16.8 | 4.60/6.00 | 286 | 67914 | 3687 | 196 |
| planetzombies | high→high | overhead | 16.7/16.8 | 4.60/7.40 | 279 | 92548 | 3769 | 144 |
| planetzombies | high→high | westInterior | 16.7/16.8 | 4.40/6.80 | 218 | 81730 | 3800 | 144 |
| planetzombies | low→low | crowd6 | 16.7/16.8 | 3.90/5.60 | 201 | 57610 | 3161 | 152 |
| planetzombies | low→low | crowd6-unbatched | 16.7/16.8 | 4.10/5.90 | 220 | 53639 | 3066 | 192 |
| planetzombies | low→low | overhead | 16.7/16.8 | 4.50/7.10 | 255 | 81948 | 3148 | 142 |
| planetzombies | low→low | westInterior | 16.7/16.8 | 3.90/5.80 | 196 | 68652 | 3145 | 143 |
| planetzombies | medium→medium | crowd6 | 16.7/16.8 | 4.00/6.40 | 210 | 66298 | 3799 | 153 |
| planetzombies | medium→medium | crowd6-unbatched | 16.7/16.8 | 4.00/6.10 | 211 | 60150 | 3687 | 196 |
| planetzombies | medium→medium | overhead | 16.7/16.8 | 3.90/5.20 | 270 | 90772 | 3767 | 144 |
| planetzombies | medium→medium | westInterior | 16.7/16.8 | 4.00/6.70 | 207 | 79526 | 3771 | 144 |

## Synthetic signature-art stress

Component fixtures only: these are not proof of gameplay or late-wave survival. FixtureAuto is explicitly fixedMedium. See rawJSON for counts, identities, memory and per-stage CPU profiles.

| Mode | Quality | Frame median/p95 ms | CPU median/p95 ms | Calls | Triangles | Instances | Materials |
|---|---|---|---|---|---|---|---|
| planetsiege | auto | 16.7/16.8 | 2.40/3.90 | 153 | 56616 | 3527 | 47 |
| planetsiege | high | 16.7/16.9 | 2.50/4.30 | 162 | 58200 | 3527 | 47 |
| planetsiege | low | 16.7/16.8 | 2.50/3.70 | 142 | 47628 | 2906 | 46 |
| planetsiege | medium | 16.7/16.8 | 2.60/4.00 | 153 | 56616 | 3527 | 47 |
| planetstrike | auto | 16.7/16.8 | 2.30/3.80 | 121 | 59950 | 3535 | 43 |
| planetstrike | high | 16.7/16.8 | 3.10/5.00 | 130 | 61534 | 3535 | 43 |
| planetstrike | low | 16.7/16.8 | 2.00/3.80 | 110 | 50962 | 2914 | 42 |
| planetstrike | medium | 16.7/16.8 | 2.70/4.20 | 121 | 59950 | 3535 | 43 |
| planetwatch | auto | 16.7/16.8 | 2.60/4.00 | 121 | 55520 | 3527 | 41 |
| planetwatch | high | 16.7/16.8 | 2.50/3.90 | 130 | 57104 | 3527 | 41 |
| planetwatch | low | 16.7/16.8 | 2.20/3.60 | 110 | 46532 | 2906 | 40 |
| planetwatch | medium | 16.7/16.8 | 2.50/4.30 | 121 | 55520 | 3527 | 41 |
| planetzombies | auto | 16.7/16.8 | 1.70/2.80 | 89 | 110120 | 3829 | 109 |
| planetzombies | high | 16.7/16.8 | 2.10/3.80 | 98 | 111704 | 3829 | 109 |
| planetzombies | low | 16.7/16.8 | 1.90/2.90 | 81 | 104468 | 3208 | 108 |
| planetzombies | medium | 16.7/16.8 | 1.80/2.80 | 89 | 110120 | 3829 | 109 |
