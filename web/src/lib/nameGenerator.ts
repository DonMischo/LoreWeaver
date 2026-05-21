/**
 * Syllable-based name generator.
 * Each style has forename and surname phoneme tables that are combined to
 * produce culturally-flavoured names without requiring an API call.
 */

export type NameType =
  // ── Real-world cultures ────────────────────────────────────────────────
  | "german" | "nordic" | "russian" | "chinese" | "japanese"
  | "arabic" | "french" | "italian" | "spanish" | "celtic"
  // ── Classic fantasy ────────────────────────────────────────────────────
  | "elvish" | "dwarven" | "orcish" | "klingon" | "fantasy"
  // ── Robots & mechs ────────────────────────────────────────────────────
  | "droid" | "robot"
  // ── Cyberpunk ─────────────────────────────────────────────────────────
  | "cyberpunk_human" | "cyberpunk_tech"
  // ── Steampunk ─────────────────────────────────────────────────────────
  | "steampunk_human" | "steampunk_tech"
  // ── Sci-Fi ────────────────────────────────────────────────────────────
  | "scifi_human" | "scifi_tech"
  // ── Cloudpunk / neon-noir ─────────────────────────────────────────────
  | "cloudpunk_human" | "cloudpunk_tech"
  // ── Star Wars species ──────────────────────────────────────────────────
  | "sw_twi_lek" | "sw_zabrak" | "sw_togruta" | "sw_chiss" | "sw_mandalorian";

export const NAME_TYPE_LABELS: Record<NameType, string> = {
  // Real-world
  german:            "German",
  nordic:            "Nordic / Norse",
  russian:           "Russian / Slavic",
  chinese:           "Chinese",
  japanese:          "Japanese",
  arabic:            "Arabic",
  french:            "French",
  italian:           "Italian",
  spanish:           "Spanish",
  celtic:            "Celtic / Irish",
  // Classic fantasy
  elvish:            "Elvish",
  dwarven:           "Dwarven",
  orcish:            "Orcish",
  klingon:           "Klingon",
  fantasy:           "Generic Fantasy",
  // Robots & mechs
  droid:             "Droid / Mech",
  robot:             "Robot / AI",
  // Cyberpunk
  cyberpunk_human:   "Cyberpunk — Human",
  cyberpunk_tech:    "Cyberpunk — Corp/Tech",
  // Steampunk
  steampunk_human:   "Steampunk — Human",
  steampunk_tech:    "Steampunk — Contraption",
  // Sci-Fi
  scifi_human:       "Sci-Fi — Human",
  scifi_tech:        "Sci-Fi — AI / Ship",
  // Cloudpunk / neon-noir
  cloudpunk_human:   "Cloudpunk — Human",
  cloudpunk_tech:    "Cloudpunk — Machine",
  // Star Wars species
  sw_twi_lek:        "Star Wars — Twi'lek",
  sw_zabrak:         "Star Wars — Zabrak",
  sw_togruta:        "Star Wars — Togruta",
  sw_chiss:          "Star Wars — Chiss",
  sw_mandalorian:    "Star Wars — Mandalorian",
};

export const NAME_TYPES = Object.keys(NAME_TYPE_LABELS) as NameType[];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function assemble(start: string[], mid: string[] | null, end: string[], midChance = 0.4): string {
  let n = pick(start);
  if (mid && Math.random() < midChance) n += pick(mid);
  n += pick(end);
  return cap(n);
}

// ── Phoneme tables ────────────────────────────────────────────────────────────

const T = {
  // ── Real-world cultures ────────────────────────────────────────────────────

  german: {
    fn: {
      s: ["kla","hein","wer","ger","wal","lud","al","ott","fried","karl","wil","ber","eg","ul","hel","diet","em","sig","herb","kurt","han","gün","det","bar","ern"],
      m: ["rich","bert","helm","frid","wig","mund"],
      e: ["aus","er","uch","ich","a","e","ard","old","ried","olf"],
    },
    sn: {
      s: ["mül","schm","web","wag","fisch","braun","koch","wolf","bau","schwar","bäck","kohl","wie","len","zim"],
      e: ["ler","idt","ner","mann","stein","berg","dorf","er","hof","wald","er","el"],
    },
  },

  nordic: {
    fn: {
      s: ["björ","er","lei","sig","rag","gun","ulf","thor","hal","sven","ing","frey","heid","gün","bör","arn","as","dag","eirik","el","grim","gunn"],
      m: ["nar","vard","fred","gard","mund","vald"],
      e: ["n","ar","en","rik","un","d","f","hjort","ulf","geir","björn","mund","vald"],
    },
    sn: {
      s: ["tor","sig","björ","erik","mag","gün","and","hal","ing","lind","strand","ham","ber","jons"],
      e: ["sson","ssen","dsen","sen","dóttir","ström","vik","berg","land","dal","holt"],
    },
  },

  russian: {
    fn: {
      s: ["ivan","dmi","ale","ser","pa","nik","vla","kon","vas","fyo","igor","bor","gri","lud","mi","ana","kat","na","ole","sveta","yu"],
      m: ["tri","xei","gei","kov","sta","mi"],
      e: ["i","a","ei","oi","islav","imir","iy","ya","ka","sha","ta","ra"],
    },
    sn: {
      s: ["vol","pet","sok","pop","leb","koz","mor","gal","nov","kir","smir","chuk","kras","zhu","gol","shch","rod"],
      e: ["ov","ova","ev","iev","sky","skiy","ko","nov","nkov","in","enko","itch"],
    },
  },

  chinese: {
    fn: {
      s: ["wei","jing","yong","jun","lei","ming","fang","yan","hua","lin","na","bo","fen","jia","ke","lan","ning","qi","rui","sha","ting","xia","xin","xue","yi","zhe","zhen","chun","gang","hao","ling"],
      m: null,
      e: [""],
    },
    sn: {
      s: ["li","wang","zhang","liu","chen","yang","huang","zhao","wu","zhou","xu","sun","ma","hu","guo","he","gao","luo","zheng","tang"],
      e: [""],
    },
  },

  japanese: {
    fn: {
      s: ["ken","hiro","take","yuki","ma","ryo","shin","kei","nao","fumi","sa","no","ka","ta","ei","yoshi","hana","na","ai","emi","rin","rei","sora","haru","natsu"],
      m: ["ko","shi","su","no","to","ka"],
      e: ["ji","shi","to","ro","ko","ru","mi","na","ki","yo","ne","ra","ka"],
    },
    sn: {
      s: ["tana","yama","wata","sa","suzu","ito","kobaya","yamada","nakamu","kato","yoshi","iwa","matu","haya","ishi"],
      e: ["ka","moto","nabe","to","ki","shi","yashi","da","ra","da","shi","i"],
    },
  },

  arabic: {
    fn: {
      s: ["o","a","has","ibra","kha","mu","yu","ah","jas","ka","fa","na","ja","sa","la","za","ha","ra","tar","yas","hus","ab"],
      m: ["ham","him","lid"],
      e: ["mar","li","san","him","lid","mad","suf","med","rim","yla","tima","isha","ina","yam","nab","yla","fiq","oud","dim","eed"],
    },
    sn: {
      s: ["al-","ibn ","abu ","abd al-","bint ","bin "],
      e: ["rashid","farouq","mansur","amin","karim","tariq","nasser","khalil","aziz","rahman","hasan","hussain","malik","omar","faris","khalid"],
    },
  },

  french: {
    fn: {
      s: ["pier","ma","jean","luc","du","fran","cla","ger","ber","hen","nic","and","char","al","gus","con","co","isa","juliett","chal","lau","ad"],
      m: ["ri","no","ger","char"],
      e: ["rre","ie","ais","ois","rd","nd","rge","nt","nc","nce","re","tte","lle","rie","oise","sse","ne","ise","nne"],
    },
    sn: {
      s: ["du","mart","ber","bon","le","gar","da","mo","sa","cha","ro","pe","la","four","bois","mi","van"],
      e: ["pont","in","ier","and","net","ois","eau","nier","bois","lin","ton","reau","lier","rand","mont","lard"],
    },
  },

  italian: {
    fn: {
      s: ["mar","lu","al","gi","franc","anto","mau","ro","val","leo","bru","car","fab","simo","cor","clau","ema","ales","dom","feli","gio","giu","isa","loren"],
      m: ["co","la","no","li"],
      e: ["co","ca","ia","a","o","le","ro","ne","to","lio","lla","nna","ra","la","ta","sa"],
    },
    sn: {
      s: ["ros","fer","bianch","conti","mar","val","lom","mor","sar","rinaul","de","es","cal","col","fan"],
      e: ["si","i","o","elli","bardi","ini","ardo","ani","atti","ello","ieri","acchi","etti"],
    },
  },

  spanish: {
    fn: {
      s: ["car","él","mig","lu","ro","jor","al","man","ped","fer","raf","gab","ant","an","cri","fran","ra","na","lour","con","isa","mar","bea"],
      m: ["nan","ber","fon","gue"],
      e: ["los","uel","as","ia","ndo","io","el","berto","na","o","s","cia","cia","sa","nuel","ola"],
    },
    sn: {
      s: ["gar","lóp","mart","rodr","fernánd","gom","díaz","mor","sánch","her","tor","alv","vaz","rub","gil"],
      e: ["cía","ez","ínez","íguez","ández","ales","era","ero","ado","illo","illo"],
    },
  },

  celtic: {
    fn: {
      s: ["finn","aoi","ciar","siob","sean","niam","ois","deir","brig","cath","mur","conn","bren","col","dar","eith","eil","fio","grá","lugh","medb","pad","rós","tara"],
      m: ["righ","nach","nach"],
      e: ["n","fe","án","han","an","h","in","dre","id","leen","a","ghe","ire","nn","mhna","bhla"],
    },
    sn: {
      s: ["o'","mac","mc","ni ","ui ","fitz"],
      e: ["brien","callagh","donn","kel","murph","bren","conno","sul","rea","lach","guinn","eilt","farr","mall","ghue","ween"],
    },
  },

  // ── Classic fantasy ────────────────────────────────────────────────────────

  elvish: {
    fn: {
      s: ["ae","el","cal","ar","gal","fin","mel","tar","cel","ara","loth","nim","cele","elen","lin","ith","amr","estel","eryn","gala","idor","ilm","irith","isil","lam","mir","nan"],
      m: ["ra","la","no","lo","mi","li","ni","ro"],
      e: ["ë","a","iel","ion","iel","inar","ond","or","riel","ndel","ndir","mir","las","lir","wen","ril","rien","lias","nor","tar"],
    },
    sn: {
      s: ["are","amr","cel","gal","gond","lin","mel","nan","nim","tele","aeg","ered","lam","mith"],
      e: ["orn","ial","iel","ond","and","inar","dan","gorn","ir","las","nor","ril","dor","rim"],
    },
  },

  dwarven: {
    fn: {
      s: ["thor","bom","bal","dwal","fi","ki","oin","glo","bif","bof","dor","nor","or","dur","krag","thrum","bel","gim","dal","brun","thur","korg","drum","mor","brog","frun","khor"],
      m: ["in","al","ur","ag"],
      e: ["in","ur","i","ok","an","or","im","og","ak","um","ik","auk","unk","arg","org","urg"],
    },
    sn: {
      s: ["iron","stone","ham","flint","forge","coal","mar","tun","gra","kil","bron","dwarf","axe","shield","brawn"],
      e: ["beard","brow","shield","forge","heim","grimm","sted","fist","back","mantle","skull","peak","deep","hold"],
    },
  },

  orcish: {
    fn: {
      s: ["gra","kru","bor","thr","sko","ug","gri","bru","urz","krog","skul","grak","dro","gor","mog","grob","krull","vorg","zug","thrax","borgr"],
      m: ["ak","ag","rak","rug","uk"],
      e: ["ash","ug","og","ok","urz","ak","ag","rok","arr","uk","ork","azh"],
    },
    sn: {
      s: ["skull","bone","blood","iron","stone","death","war","flesh","claw","gore","dread","ruin"],
      e: ["crusher","basher","smasher","render","ripper","breaker","grinder","splitter","biter","mauler","shaker"],
    },
  },

  klingon: {
    fn: {
      s: ["qo","ga","ko","du","wa","to","ma","ba","ra","kla","gha","cha","qar","wu","yo","gh","tlh","mo","tagh","qa","bor","tur","jegh"],
      m: ["'a","'u","gh","tlh","'o"],
      e: ["q","k","ng","gh","wI'","rop","taj","mIv","ran","rgh","ach","cha","wor","kor","mar"],
    },
    sn: {
      s: ["mo","tur","ka","du","wor","ko","qo","ghom","pum","be","cho","jat","luH"],
      e: ["gh","'oq","tlh","a'ra","ka","'ach","ghor","wI'","kor","naj"],
    },
  },

  fantasy: {
    fn: {
      s: ["aer","bra","cae","drev","era","fae","gael","hyr","ith","jor","kes","lyra","mael","nys","oph","pael","ryth","sael","tyr","una","vael","wyr","ysel","zael","aur","bel","caer","drae","fael"],
      m: ["ae","el","yr","is","or","an","en"],
      e: ["is","ar","os","en","iel","on","un","ia","ath","el","in","ys","an","or","ix","ax","era"],
    },
    sn: {
      s: ["star","moon","night","dawn","storm","ember","silver","shadow","swift","iron","wild","ash","storm","wind","grey","gold","dark","light","stone","fire"],
      e: ["blade","vale","haven","wick","wood","ford","fell","born","mire","shire","gate","keep","hold","mark","meer"],
    },
  },

  // ── Robots & mechs ────────────────────────────────────────────────────────

  droid: {
    fn: {
      // Alphanumeric combos — cap() will uppercase the first char, giving R2, Bb, etc.
      s: ["R2","BB","C3","K2","L3","EV","IG","T3","R4","R5","A1","M5","B1","2","3","4"],
      m: ["-D","-S","-P","-G","-L","-R"],
      e: ["-D2","-8","PO","SO","-7","-37","-88","-11","2","-O","3","-9"],
    },
    sn: {
      s: ["Mark ","Series ","Type ","Class ","Unit ","Model "],
      e: ["I","II","IV","V","Alpha","Prime","Zero","7","9","X","3"],
    },
  },

  robot: {
    fn: {
      s: ["ari","nex","hal","orb","ark","vor","zen","cyr","tit","mag","alt","omn","ult","vir","cor","sol"],
      m: null,
      e: ["a","us","on","ix","is","ar","ia","ax","an","um","ex","oid","en","or"],
    },
    sn: {
      s: ["Unit ","Mark ","Series ","Model ","Ver. "],
      e: ["7","9","X","Alpha","Prime","Zero","IV","II","9B","3"],
    },
  },

  // ── Cyberpunk ────────────────────────────────────────────────────────────

  cyberpunk_human: {
    fn: {
      // Street names + mixed-origin given names (Asian/Latin/Anglo blend)
      s: ["neo","kira","vik","jinx","raz","ash","zoe","cas","hex","nyx","blaz","vex","dusk","rook","ech","ax","kai","rei","jun","tak","mir","sev","ren","lux"],
      m: ["da","ra","shi","ko","la"],
      e: ["","e","a","o","er","en","in","i","on"],
    },
    sn: {
      s: ["yam","tan","chen","nak","kon","hir","syn","net","hard","val","kira","loz"],
      e: ["ada","oto","aka","oshi","ano","agawa","wire","burn","run","hack","nova","sky"],
    },
  },

  cyberpunk_tech: {
    fn: {
      // Corporate AI / tech designations
      s: ["chrom","ax","grid","byt","flux","nan","hyp","opt","omni","cor","nex","crypt","syn","netw","arc","puls"],
      m: ["o","a","i","net","core","sys"],
      e: ["7","X","9","net","core","wire","link","sync","tech","ware","run","grid","byte"],
    },
    sn: {
      s: ["Corp","Sys","Net","Grid","Arc","Inf","Hyp","Data","Neon"],
      e: ["Tech","Ware","Link","Net","Core","Wire","Sync","Run","7","X"],
    },
  },

  // ── Steampunk ────────────────────────────────────────────────────────────

  steampunk_human: {
    fn: {
      // Victorian / Edwardian given names
      s: ["al","bar","clar","ed","eu","geo","hor","lawr","reg","sev","vic","wald","isa","eva","bea","har","rob","ern","wil","fen","clem","pru","ade","aug"],
      m: ["bert","tha","ence","ward","gen","rey","race","bald"],
      e: ["","a","e","us","ia","ine","ton","ford","ard"],
    },
    sn: {
      // English/Victorian surnames
      s: ["black","brown","coal","fen","gold","ham","kent","march","north","rail","stone","wheel","ash","bri","cop","lock"],
      e: ["worth","ton","wick","ford","shire","field","wood","ridge","ley","burn","brook","dale","hurst"],
    },
  },

  steampunk_tech: {
    fn: {
      // Mechanical contraption designations
      s: ["cog","gear","bolt","brass","click","whir","clink","ratch","pist","bel","sprock","throt","cal","vent","valve"],
      m: ["o","a","i","el"],
      e: ["sworth","et","on","ick","le","or","ins","worth","er","ing"],
    },
    sn: {
      s: ["Iron ","Brass ","Steam ","Copper ","Steel ","Silver ","Bronze "],
      e: ["Mk.I","Mk.II","Mk.III","Proto","Alpha","Beta","Prime","Deluxe"],
    },
  },

  // ── Sci-Fi ───────────────────────────────────────────────────────────────

  scifi_human: {
    fn: {
      // Futuristic human names — melting pot of roots
      s: ["jor","zeph","lyra","kael","tris","vael","nyx","axel","ryn","sol","lux","cas","ren","val","tyr","zen","ora","kyra","lex","mar","dax","eve","jax","lan"],
      m: ["an","el","ar","en","ia"],
      e: ["en","an","is","on","a","e","yn","or","us","yx","ix"],
    },
    sn: {
      s: ["sol","star","nov","cos","lun","astr","gal","orb","zen","arc","quan","hel"],
      e: ["aris","ander","ova","ine","ax","ion","us","is","ara","ack","ir","eon"],
    },
  },

  scifi_tech: {
    fn: {
      // AI / ship / system names (mythological + constructed)
      s: ["ari","nex","prom","athe","ora","cal","har","mon","vir","iris","axi","opt","tit","alp","min","her","apol"],
      m: null,
      e: ["a","us","on","is","ix","an","um","oma","ene","eus","ia","arch","eus"],
    },
    sn: {
      s: ["Deep ","Star ","Arc ","Sys ","Net ","Core ","Alt ","Sol ","Hyp "],
      e: ["Mind","Core","Gate","Link","Drive","Space","Net","Hub","Port","Node"],
    },
  },

  // ── Cloudpunk / neon-noir ─────────────────────────────────────────────────

  cloudpunk_human: {
    fn: {
      // Rain-slicked neon city names — soft, evocative, short
      s: ["rain","noa","rik","mis","haz","neon","dusk","nov","ash","sil","lun","drif","kaz","veil","trac","hal","eira","cas","lum","dove"],
      m: null,
      e: ["","e","a","o","i","en","el","in"],
    },
    sn: {
      s: ["cloud","rain","mist","fog","haze","neon","grid","wire","sky","arc","drift","halo"],
      e: ["runner","walk","drift","dive","born","fall","break","shine","touch","rise"],
    },
  },

  cloudpunk_tech: {
    fn: {
      // Delivery drones, cloud-city machines
      s: ["hov","clou","sky","arc","dron","serv","carr","tran","del","haul","pods","lift","glid"],
      m: null,
      e: ["d","t","r","-7","-3","-9","bot","ey","ver","-5","zer","ter"],
    },
    sn: {
      s: ["Model ","Unit ","Fleet ","Pod ","Rig "],
      e: ["Alpha","7","9-X","Zero","Prime","3","II","Delta"],
    },
  },

  // ── Star Wars species ─────────────────────────────────────────────────────

  sw_twi_lek: {
    fn: {
      // Soft, vowel-heavy; often doubled letters — Aayla, Hera, Bib Fortuna, Oola
      s: ["aa","bi","hib","naa","oo","ryl","sev","lyn","cor","shaa","ra","griss","met","fen","lyb","chan","hib","tav"],
      m: ["la","ra","na","ba","ya"],
      e: ["yla","b","ah","la","ra","na","ba","wa","ha","le","i","mela","atha","una"],
    },
    sn: {
      s: ["for","sec","tri","ma","bib","ryl","syn","cor"],
      e: ["tuna","ura","oth","arik","anth","ellu","ada","ora"],
    },
  },

  sw_zabrak: {
    fn: {
      // Harsh, short; Zabrak & Dathomirian — Maul, Savage, Feral, Eeth Koth
      s: ["mau","sav","fer","eeth","sug","agen","darou","korr","lok","tur","fal","druk","kas","brak"],
      m: null,
      e: ["l","age","al","i","ath","an","ok","rak","om","ir","ek","us"],
    },
    sn: {
      s: ["koth","kol","opre","turr","lok","fal","dath","kas"],
      e: ["","ar","ss","i","en","om","ir"],
    },
  },

  sw_togruta: {
    fn: {
      // Fluid, multi-syllable — Ahsoka Tano, Shaak Ti, Raana Tey
      s: ["ahs","sha","raa","ash","tog","shan","sall","kel","jura","mir","taa","stass","sel"],
      m: null,
      e: ["oka","ak","na","la","ru","sa","ri","va","li","ta","ka","ki","no"],
    },
    sn: {
      s: ["ta","ra","sha","kel","mir","vos","tey","syn"],
      e: ["no","va","ak","sha","li","na","ri","ka"],
    },
  },

  sw_chiss: {
    fn: {
      // Formal, complex, often with apostrophes — Mitth'raw'nuruodo (Thrawn), Ar'alani
      s: ["mitth","brast","ufsa","brun","isa","ar","stent","drask","vah","tris","syn"],
      m: ["'raw'","'a'","'ro'","'al'","'ur'","'is'"],
      e: ["nuruodo","ani","ana","is","odo","anto","edi","oka","ari","eni"],
    },
    sn: {
      // House/family names (core name without the 'raw' section)
      s: ["mitth","irizi","brun","vak","csap","ufsa","prae","brast"],
      e: ["'raw","'al","'ro","'odo","'ani","'eno","'is"],
    },
  },

  sw_mandalorian: {
    fn: {
      // Din, Bo, Pre, Paz, Sabine, Fenn — short and hard-consonant
      s: ["din","bo","pre","paz","sab","fenn","urs","tob","ax","kor","rook","gid","bram","hel","kot","jast","ven"],
      m: null,
      e: ["","ine","a","us","on","ek","irt","al","en","ik"],
    },
    sn: {
      // Clan names — Djarin, Kryze, Vizsla, Wren, Fett
      s: ["djarin","kryze","vizsla","wren","fett","rau","ordo","dra","kal","vas","keld","mand","tal"],
      e: ["","a","or","ell","is","ora","ak","an"],
    },
  },

} satisfies Record<NameType, { fn: { s: string[]; m: string[] | null; e: string[] }; sn: { s: string[]; e: string[] } }>;

// ── Public API ────────────────────────────────────────────────────────────────

export interface GeneratedName {
  first: string;
  last: string;
}

export function generateName(type: NameType): GeneratedName {
  const { fn, sn } = T[type];
  const first = assemble(fn.s, fn.m, fn.e);
  const last  = assemble(sn.s, null, sn.e, 0);
  return { first, last };
}
