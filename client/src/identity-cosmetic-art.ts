/** Decorative, self-contained identity art. Only complete catalog IDs select markup. */
interface Theme {
  name:string;
  ink:string;
  field:string;
  accent:string;
  glint:string;
  scene:string;
  insignia:string;
}

const themes:readonly Theme[]=[
  {
    name:"solar-vanguard",ink:"#211727",field:"#853e43",accent:"#ffab51",glint:"#ffe5a1",
    scene:`
      <g stroke="var(--a)" opacity=".45"><path d="m226 57-15-7m21-2-13-9m22 1-9-13m22 8-4-16m17 16 2-17m11 21 7-16m5 22 12-13m-5 22 15-8"/></g>
      <circle cx="263" cy="66" r="33" fill="var(--a)"/><circle cx="263" cy="66" r="25" fill="#ffd37d"/>
      <path d="M155 100 187 82l21 4 26-18 24 9 22-16 24 11 27-21 29 9v60H155z" fill="#a45a50"/>
      <path d="m151 111 35-14 20 2 18-10 25 4 27-12 19 3 34-18 31 9v45H151z" fill="#653a43"/>
      <path d="M184 111h17V94h8v-9h7v22h7V86h10V73l5-6 5 6v14h9v13h9V80h8v-8h5v27h9V84h6V63h6V53l4-7 4 7v10h6v33h9V78h10v22h8V84h6v-7h5v20h10v23H184z" fill="var(--i)"/>
      <path d="M233 86h10m48-22h16m-9-12v-9m-94 54h9m47-13h8" stroke="var(--g)" stroke-width="2"/>
      <path d="m182 118 129-18 49 6" fill="none" stroke="#e58f65" stroke-width="2"/>`,
    insignia:`<path d="m12 1 3.1 4.1 5 .8.8 5.4L12 23 3.1 11.3l.8-5.4 5-.8z" fill="var(--i)" stroke="var(--a)" stroke-width="1.5"/><path d="M5 12.8h14l-7 8.2z" fill="var(--a)"/><path d="M7.2 11.5a4.8 4.8 0 0 1 9.6 0z" fill="var(--g)"/><path d="M12 3.2v2m-6.1 1.3 1.7 1.2m10.5-1.2-1.7 1.2" stroke="var(--a)" stroke-width="1.4"/>`,
  },
  {
    name:"void-explorer",ink:"#10172d",field:"#403873",accent:"#b7a4ff",glint:"#bff8ff",
    scene:`
      <path d="M178 105q67-81 182-82v21q-106 0-182 61z" fill="#9b67b9" opacity=".24"/>
      <g fill="var(--g)"><circle cx="193" cy="25" r="1"/><circle cx="237" cy="20" r="1.4"/><circle cx="211" cy="80" r="1"/><circle cx="335" cy="74" r="1.3"/><path d="m326 12 1.5 4.8 4.5 1.2-4.5 1.2-1.5 4.8-1.5-4.8-4.5-1.2 4.5-1.2z"/></g>
      <ellipse cx="280" cy="64" rx="65" ry="13" transform="rotate(-24 280 64)" fill="none" stroke="#ab9ac9" stroke-width="3"/>
      <circle cx="280" cy="62" r="37" fill="var(--a)"/><path d="M270 26a37 37 0 0 1 27 69q-43-7-27-69z" fill="#63588f"/>
      <path d="M277 32q22 6 32 24m-29-14q21 8 30 25m-24-7 19 18" fill="none" stroke="#8875ac" stroke-width="3"/>
      <path d="M221 89q21 5 72-16 39-17 47-33" fill="none" stroke="var(--g)" stroke-width="3"/>
      <path d="m194 61 17-8 12 1-14 7-2 5-4-5z" fill="var(--g)"/><path d="m184 66 15-7" stroke="var(--a)" stroke-width="2"/>
      <circle cx="346" cy="104" r="26" fill="#212743"/><path d="M321 99q9-26 35-20" fill="none" stroke="#a08bbb" stroke-width="2"/>`,
    insignia:`<path d="m12 1 9 5v10l-9 7-9-7V6z" fill="var(--i)" stroke="var(--a)" stroke-width="1.5"/><circle cx="12" cy="11.5" r="5.7" fill="var(--a)"/><path d="M11.5 6a5.7 5.7 0 0 1 1 11q-4.1-4.4-1-11z" fill="#746bb0"/><ellipse cx="12" cy="12" rx="9" ry="2.2" transform="rotate(-29 12 12)" fill="none" stroke="var(--g)" stroke-width="1.5"/>`,
  },
  {
    name:"orbital-engineer",ink:"#10272c",field:"#275f64",accent:"#69d7c6",glint:"#fff0b0",
    scene:`
      <path d="M169 33h151m-142 23h174M180 82h165m-138-67v83m25-86v98m28-102v103m27-99v97m30-89v81" fill="none" stroke="var(--a)" opacity=".19"/>
      <g transform="rotate(-17 266 59)">
        <path d="M194 54h147v9H194z" fill="#98b9b9"/><path d="M197 34h47v47h-47zm91 0h46v47h-46z" fill="#143b4b" stroke="var(--a)" stroke-width="2"/>
        <path d="M212 34v47m16-47v47m74-47v47m16-47v47m-121-32h47m-47 16h47m44-16h46m-46 16h46" stroke="#6fa3a6" stroke-width="1.5"/>
        <path d="m249 43 13-10 16 7 5 22-12 15-18-5z" fill="#bccbc1" stroke="#19363f" stroke-width="2"/>
        <path d="m257 49 10-7 9 7 1 11-9 8-10-6z" fill="#267980"/><circle cx="267" cy="55" r="4.5" fill="var(--g)"/>
      </g>
      <path d="m225 115 12-11 16-3 12-15 23-5 15-15 20 2 24-8 13 5v55H225z" fill="#183941"/>
      <path d="m304 105 7-25 15-13-11-17-3 1 4 15-14 10-11 24" fill="#c49d62" stroke="#243740" stroke-width="2"/>
      <circle cx="310" cy="78" r="4" fill="var(--g)"/><circle cx="322" cy="66" r="3" fill="var(--g)"/>`,
    insignia:`<path d="m6 2 12 0 5 10-6 10H7L1 12z" fill="var(--i)" stroke="var(--a)" stroke-width="1.5"/><path d="m5 16 3 3 7-8a5 5 0 0 0 4-6l-3 3-2-2 3-3a5 5 0 0 0-6 6z" fill="var(--g)"/><circle cx="7.7" cy="16.6" r="1" fill="var(--i)"/>`,
  },
  {
    name:"crown-collector",ink:"#291c34",field:"#684064",accent:"#efbb68",glint:"#fff0b6",
    scene:`
      <path d="M208 120V40l52-36 60 36v80m-99 0V48l39-29 47 29v72" fill="none" stroke="#ba8092" stroke-width="2" opacity=".5"/>
      <path d="m346 13-19 83h13l20-68V13z" fill="#d2a959" opacity=".22"/>
      <path d="m213 106 51-17 55 16-53 15z" fill="#ce8f69"/><path d="m213 106 53 14h-55zm53 14 53-15v15z" fill="#85516a"/>
      <path d="m226 51 22 15 14-34 19 33 25-18-10 39-33 12-28-12z" fill="var(--a)" stroke="#352b44" stroke-width="2"/>
      <path d="m235 61 17 15 9-29 2 38-24-6zm33-6 11 21 18-14-6 16-23 7z" fill="#986347"/>
      <path d="m236 83 27 9 33-10-2 7-30 11-26-10z" fill="var(--g)"/><path d="m261 65 6 8-5 9-5-8z" fill="#945587"/>
      <g fill="var(--g)"><path d="m211 42 2 5 5 2-5 2-2 5-2-5-5-2 5-2zm97-18 2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></g>`,
    insignia:`<path d="m2 7 6 4 4-8 4 8 6-4-3 11-7 4-7-4z" fill="var(--a)" stroke="var(--i)" stroke-width="1.5"/><path d="m5.5 12 3.5 1.8 3-6 3 6 3.5-1.8-1 4-5.5 2.6L6.5 16z" fill="#795164"/><path d="m12 10 2.1 3.6L12 16l-2.1-2.4z" fill="var(--g)"/><path d="m6.4 17 5.6 2.7 5.6-2.7" fill="none" stroke="var(--g)" stroke-width="1.4"/>`,
  },
  {
    name:"ion-runner",ink:"#132134",field:"#216078",accent:"#6cf1ee",glint:"#e3ffad",
    scene:`
      <path d="m165 111 99-50 96-23v15l-90 17z" fill="#427582"/><path d="M170 120q52-37 108-50t82-43v18q-15 20-76 34t-86 41z" fill="#293d5e"/>
      <path d="M183 120q48-34 99-46t78-37m-150 83q48-28 83-36t67-28" fill="none" stroke="var(--a)" stroke-width="2"/>
      <path d="m217 48 40-14m-52 29 54-21m-42 28 30-11" stroke="var(--g)" stroke-width="2" opacity=".65"/>
      <g transform="rotate(-13 279 53)"><path d="m236 56 30-7 12-13 42-2-16 13-35 10-10 9-20 2 10-9z" fill="#203342" stroke="var(--a)" stroke-width="2"/>
      <path d="m267 49 13-12 29-1-17 10z" fill="var(--g)"/><path d="m267 54 24-6-12 9-20 7z" fill="#72baca"/>
      <path d="m237 60-24 6 15-8zm10-8-21 3 14-7z" fill="var(--a)"/></g>
      <path d="m307 115 18-15h9l-16 15zm18 0 18-15h9l-16 15z" fill="var(--a)" opacity=".55"/>`,
    insignia:`<path d="M1 15 9 4h13l-6 8h5L8 22l3-8z" fill="var(--i)" stroke="var(--a)" stroke-width="1.5"/><path d="m4 13 6-7h9l-6 7h4l-6 5 2-7z" fill="var(--g)"/><path d="m2 18 5-2m-6 5 5-2" stroke="var(--a)" stroke-width="1.6"/>`,
  },
  {
    name:"shatter-champion",ink:"#211b37",field:"#65406f",accent:"#f596c9",glint:"#beeeff",
    scene:`
      <path d="m165 86 50-55 35 7-35 22-10 30z" fill="#68527d"/><path d="m180 93 41-42 12 1-35 35z" fill="#ad78a7"/>
      <path d="m204 111 33-41 27-5-17 28-25 18zm47-6 25-35 16 6-9 23-15 13z" fill="#9791bd"/>
      <path d="m267 59 15-42 19-8-7 29z" fill="var(--g)"/><path d="m267 59 17-21 10 0-12 14z" fill="#7895b2"/>
      <path d="m281 64 35-31 14 7-27 18zm17 9 35-8 12 11-29 7z" fill="var(--a)"/>
      <path d="m242 57 4-16 14-10-4 20zm50 31 13-10 8 11-14 13z" fill="#db9cdb"/>
      <path d="m182 113 42-10 23 5 24-11 29 5 36-19 24 6v31H182z" fill="#352b49"/>
      <path d="m259 63-13 10 10-2-14 19 24-22-7 1 15-16z" fill="#fff2ff"/>
      <path d="m230 115 15-8 7 3 17-11m39 10 11-9 8 1 15-13" fill="none" stroke="var(--a)" stroke-width="1.5"/>`,
    insignia:`<path d="m2 7 10-5 10 5-2 9-8 7-8-7z" fill="var(--i)" stroke="var(--a)" stroke-width="1.5"/><path d="m5 8 7-3-2 6-3 4zm10-3 4 3-5 5-3 1zm3 7-1 4-5 4 2-5z" fill="var(--g)"/><path d="m8 18 3-5 3-1-5 8z" fill="var(--a)"/>`,
  },
];
const cardArt=new Map<string,string>(),emblemArt=new Map<string,string>();
for(const theme of themes){
  const palette=`--i:${theme.ink};--a:${theme.accent};--g:${theme.glint}`;
  const gradient=`pf-card-${theme.name}-field`;
  cardArt.set(`card-${theme.name}`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" style="${palette}"><defs><linearGradient id="${gradient}"><stop stop-color="${theme.ink}"/><stop offset=".43" stop-color="${theme.ink}"/><stop offset="1" stop-color="${theme.field}"/></linearGradient></defs><path fill="url(#${gradient})" d="M0 0h360v120H0z"/>${theme.scene}</svg>`);
  emblemArt.set(`emblem-${theme.name}`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" style="${palette}">${theme.insignia}</svg>`);
}

export function callingCardSvg(id:string):string|null {return cardArt.get(id)??null;}
export function emblemSvg(id:string):string|null {return emblemArt.get(id)??null;}
