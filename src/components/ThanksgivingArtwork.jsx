import { useId } from "react";

export function ThanksgivingArtwork({ className = "" }) {
  const id = useId().replaceAll(":", "");
  return (
    <svg className={className} viewBox="0 0 720 330" role="img" aria-label="A turkey escaping a tangled farmyard of winding paths, chicken-wire walls, hay bales, and crates" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor="#e6bc73"/><stop offset="1" stopColor="#fff0ba"/></linearGradient>
        <pattern id={`${id}-wire`} width="18" height="22" patternUnits="userSpaceOnUse"><path d="m9 0 9 11-9 11L0 11Z" fill="none" stroke="#ddd7a4" strokeWidth="1"/></pattern>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h720v330H0z"/>
      <circle cx="558" cy="68" r="39" fill="#fff4ce"/>
      <path d="M0 126Q100 66 238 127T483 106T720 120V330H0Z" fill="#89905a"/>
      <path d="M0 184Q170 128 339 169T720 149V330H0Z" fill="#657345"/>
      <path d="M0 207 155 167l165 6 82-30 167 25 151 26v136H0Z" fill="#c09964"/>
      <g fill="#828146" stroke="#9b9b59" strokeWidth="2">
        <path d="m215 170 108 12-24 31-100-11Z"/><path d="m396 177 105-13 14 27-39 17-82-3Z"/>
        <path d="m76 267 105-29 48 22-44 30-90 16Z"/><path d="m438 259 68-27 88 30-54 35-111-5Z"/>
        <path d="m608 177 112 23v53l-84-21Z"/>
      </g>
      <g stroke="#b0a353" strokeWidth="4"><path d="m215 183 86 12m-95 0 84 11m151 71 105-14m-106 28 114-14m65-69 77 25"/></g>
      <g transform="translate(71 64)">
        <path d="M0 87 57 15l69 73v85H0Z" fill="#a64733"/><path d="m-12 86 69-83 80 82-12 12L57 25 0 96Z" fill="#513d36"/>
        <path d="M41 117h47v56H41Z" fill="#4c382b" stroke="#efcf91" strokeWidth="4"/><path d="m42 117 44 55m0-55-44 55" stroke="#efcf91" strokeWidth="3"/>
        <path d="M46 65h25v29H46Z" fill="#eac78c"/><path d="M58 65v29" stroke="#513d36" strokeWidth="3"/>
      </g>
      <g fill="#b96934"><circle cx="20" cy="113" r="38"/><circle cx="657" cy="121" r="49"/><circle cx="709" cy="91" r="36"/></g>
      <g fill="#d69944"><circle cx="27" cy="93" r="29"/><circle cx="645" cy="98" r="36"/><circle cx="695" cy="71" r="27"/></g>
      <g stroke="#614a31" strokeWidth="9"><path d="M17 119v66m649-67v61m51-81v82"/></g>
      <path d="m0 264 209-48v37L0 307Zm505-64 215 59v44l-215-60Z" fill={`url(#${id}-wire)`} stroke="#d6cd9c" strokeWidth="2"/>
      <g stroke="#725034" strokeWidth="7"><path d="M26 252v56m88-76v55m89-80v51m309-64v52m91-26v52m88-27v55"/></g>
      <g fill={`url(#${id}-wire)`} stroke="#ded3a1" strokeWidth="2">
        <path d="m206 163 117 16-23 31v-23l23-31-117-16Z"/>
        <path d="m396 195 80 10 40-17v-25l-40 17-80-10Z"/>
        <path d="m102 301 84-13 39-28v-29l-39 28-84 13Z"/>
        <path d="m436 294 104 6 49-38v-28l-49 38-104-6Z"/>
      </g>
      <g stroke="#725034" strokeWidth="5"><path d="M206 139v29m117-15v28m-23 3v29m96-45v31m80-21v29m40-46v30m-414 78v35m84-47v34m39-61v34m211 1v31m104-23v32m49-70v34"/></g>
      <g fill="#d9af5e" stroke="#8b6b39" strokeWidth="2">
        <rect x="241" y="217" width="36" height="24" rx="3"/><rect x="252" y="194" width="35" height="23" rx="3"/>
        <rect x="596" y="278" width="44" height="28" rx="3"/><rect x="617" y="256" width="42" height="24" rx="3"/>
        <path d="M251 218v23m15-23v23m-4-47v23m14-23v23m331 61v28m20-28v28m-1-50v24m19-24v24"/>
      </g>
      <g fill="#946840" stroke="#d5b176" strokeWidth="3"><path d="M410 216h30v28h-30Z"/><path d="m411 217 28 26m-28 0 28-26"/><path d="M33 230h28v25H33Z"/><path d="m34 231 26 23"/></g>
      <g transform="translate(360 247)">
        <g stroke="#633c28" strokeWidth="3"><ellipse cx="-27" cy="-25" rx="13" ry="29" fill="#b86631" transform="rotate(-48 -27 -25)"/><ellipse cx="-12" cy="-39" rx="13" ry="29" fill="#d99a47" transform="rotate(-18 -12 -39)"/><ellipse cx="7" cy="-39" rx="13" ry="29" fill="#c67a35" transform="rotate(18 7 -39)"/><ellipse cx="23" cy="-27" rx="13" ry="29" fill="#e1ad55" transform="rotate(46 23 -27)"/></g>
        <ellipse cx="-1" cy="-4" rx="28" ry="31" fill="#654731"/><path d="m-14 21-7 17m27-15 8 15" stroke="#e4a343" strokeWidth="5"/>
        <ellipse cx="13" cy="-15" rx="11" ry="22" fill="#81a7a1"/><circle cx="15" cy="-35" r="14" fill="#9fc1b0"/><path d="m26-37 17 7-18 5Z" fill="#f1bc5b"/><path d="M22-28q17 20 2 20" stroke="#d95943" strokeWidth="8" fill="none" strokeLinecap="round"/><circle cx="20" cy="-39" r="3" fill="#251e1c"/>
      </g>
      <g fill="#f8d35f" stroke="#886735" strokeWidth="1.5"><ellipse cx="464" cy="298" rx="8" ry="4" transform="rotate(-25 464 298)"/><ellipse cx="513" cy="314" rx="7" ry="4"/><ellipse cx="421" cy="278" rx="7" ry="4"/></g>
      <g transform="translate(555 196)"><path d="m-9 10-4 20m17-20 6 20" stroke="#3b4949" strokeWidth="7"/><path d="M-13-17h27v31h-27Z" fill="#607c83"/><path d="m-12-14-10 19m33-19 14 15" stroke="#b77a52" strokeWidth="7"/><circle cy="-26" r="11" fill="#d49b68"/><ellipse cy="-35" rx="23" ry="6" fill="#e4b45e"/><path d="M-12-36v-13h24v13" fill="#d5a352"/></g>
    </svg>
  );
}
