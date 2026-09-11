import "dotenv/config";
import { getDb } from "../lib/db";
import { slaRules, transitStations } from "../lib/db/schema";

// Master-data seed — idempotent (onConflictDoNothing on natural keys).
// Stations: Bangkok BTS/MRT/ARL, values verbatim.
// SLA rules: follow-up windows by potential (DATA_MODEL §1.7).
//
// NO ZONES ON PURPOSE. Zones are the client's coverage areas, so they are
// entered in Settings › โซน rather than shipped as somebody else's list.

const BTS = [
  "N24 - คูคต", "N23 - แยก คปอ.", "N22 - พิพิธภัณฑ์กองทัพอากาศ",
  "N21 - โรงพยาบาลภูมิพลอดุลยเดช", "N20 - สะพานใหม่", "N19 - สายหยุด",
  "N18 - พหลโยธิน 59", "N17 - วัดพระศรีมหาธาตุ", "N16 - กรมทหารราบที่ 11",
  "N15 - บางบัว", "N14 - กรมป่าไม้", "N13 - มหาวิทยาลัยเกษตรศาสตร์",
  "N12 - เสนานิคม", "N11 - รัชโยธิน", "N10 - พหลโยธิน 24",
  "N09 - ห้าแยกลาดพร้าว", "N08 - หมอชิต", "N07 - สะพานควาย", "N06 - เสนาร่วม",
  "N05 - อารีย์", "N04 - สนามเป้า", "N03 - อนุสาวรีย์ชัยสมรภูมิ",
  "N02 - พญาไท", "N01 - ราชเทวี", "CEN - สยาม", "E01 - ชิดลม",
  "E02 - เพลินจิต", "E03 - นานา", "E04 - อโศก", "E05 - พร้อมพงษ์",
  "E06 - ทองหล่อ", "E07 - เอกมัย", "E08 - พระโขนง", "E09 - อ่อนนุช",
  "E10 - บางจาก", "E11 - ปุณณวิถี", "E12 - อุดมสุข", "E13 - บางนา",
  "E14 - แบริ่ง", "E15 - สำโรง", "E16 - ปู่เจ้า", "E17 - ช้างเอราวัณ",
  "E18 - โรงเรียนนายเรือ", "E19 - ปากน้ำ", "E20 - ศรีนครินทร์",
  "E21 - แพรกษา", "E22 - สายลวด", "E23 - เคหะฯ", "W01 - สนามกีฬาแห่งชาติ",
  "S01 - ราชดำริ", "S02 - ศาลาแดง", "S03 - ช่องนนทรี", "S04 - เซนต์หลุยส์",
  "S05 - สุรศักดิ์", "S06 - สะพานตากสิน", "S07 - กรุงธนบุรี",
  "S08 - วงเวียนใหญ่", "S09 - โพธิ์นิมิตร", "S10 - ตลาดพลู", "S11 - วุฒากาศ",
  "S12 - บางหว้า", "G1 - กรุงธนบุรี", "G2 - เจริญนคร", "G3 - คลองสาน",
  "G4 - ประชาธิปก", "RN01 - บางซื่อ", "RN02 - จตุจักร",
  "RN03 - วัดเสมียนนารี", "RN04 - บางเขน", "RN05 - ทุ่งสองห้อง",
  "RN06 - หลักสี่", "RN07 - การเคหะ", "RN08 - ดอนเมือง",
  "RN09 - หลักหก (มหาวิทยาลัยรังสิต)", "RN10 - รังสิต", "RW01 - บางซื่อ",
  "RW02 - บางซ่อน", "RW03 - สะพานพระราม 6", "RW04 - บางกรวย กฟผ",
  "RW05 - บางบำหรุ", "RW06 - ตลิ่งชัน",
];

const MRT = [
  "BL01 - ท่าพระ", "BL02 - จรัญฯ 13", "BL03 - ไฟฉาย", "BL04 - บางขุนนนท์",
  "BL05 - บางยี่ขัน", "BL06 - สิรินธร", "BL07 - บางพลัด", "BL08 - บางอ้อ",
  "BL09 - บางโพ", "BL10 - เตาปูน", "BL11 - บางซื่อ", "BL12 - กำแพงเพชร",
  "BL13 - สวนจตุจักร", "BL14 - พหลโยธิน", "BL15 - ลาดพร้าว",
  "BL16 - รัชดาภิเษก", "BL17 - สุทธิสาร", "BL18 - ห้วยขวาง",
  "BL19 - ศูนย์วัฒนธรรมแห่งประเทศไทย", "BL20 - พระราม 9", "BL21 - เพชรบุรี",
  "BL22 - สุขุมวิท", "BL23 - ศูนย์การประชุมแห่งชาติสิริกิติ์",
  "BL24 - คลองเตย", "BL25 - ลุมพินี", "BL26 - สีลม", "BL27 - สามย่าน",
  "BL28 - หัวลำโพง", "BL29 - วัดมังกร", "BL30 - สามยอด", "BL31 - สนามไชย",
  "BL32 - อิสรภาพ", "BL33 - บางไผ่", "BL34 - บางหว้า", "BL35 - เพชรเกษม 48",
  "BL36 - ภาษีเจริญ", "BL37 - บางแค", "BL38 - หลักสอง",
  "PP01 - คลองบางไผ่", "PP02 - ตลาดบางใหญ่", "PP03 - สามแยกบางใหญ่",
  "PP04 - บางพลู", "PP05 - บางรักใหญ่", "PP06 - บางรักน้อยท่าอิฐ",
  "PP07 - ไทรม้า", "PP08 - สะพานพระนั่งเกล้า", "PP09 - แยกนนทบุรี 1",
  "PP10 - บางกระสอ", "PP11 - ศูนย์ราชการนนทบุรี", "PP12 - กระทรวงสาธารณสุข",
  "PP13 - แยกติวานนท์", "PP14 - วงศ์สว่าง", "PP15 - บางซ่อน",
  "PP16 - เตาปูน", "OR01 - บางขุนนนท์", "OR02 - ศิริราช", "OR03 - สนามหลวง",
  "OR04 - อนุสาวรีย์ประชาธิปไตย", "OR05 - หลานหลวง", "OR06 - ยมราช",
  "OR07 - ราชเทวี", "OR08 - ประตูน้ำ", "OR09 - ราชปรารภ", "OR10 - รางน้ำ",
  "OR11 - ดินแดง", "OR12 - ประชาสงเคราะห์",
  "OR13 - ศูนย์วัฒนธรรมแห่งประเทศไทย", "OR14 - รฟม.",
  "OR15 - วัดพระราม ๙", "OR16 - รามคำแหง 12", "OR17 - ม.รามคำแหง",
  "OR18 - กกท.", "OR19 - รามคำแหง 34", "OR20 - แยกลำสาลี",
  "OR21 - ศรีบูรพา", "OR22 - คลองบ้านม้า", "OR23 - สัมมากร",
  "OR24 - น้อมเกล้า", "OR25 - ราษฎร์พัฒนา", "OR26 - มีนพัฒนา",
  "OR27 - เคหะรามคำแหง", "OR28 - มีนบุรี", "OR29 - แยกร่มเกล้า",
  "YL01 - ลาดพร้าว", "YL02 - ภาวนา", "YL03 - โชคชัย 4",
  "YL04 - ลาดพร้าว 71", "YL05 - ลาดพร้าว 83", "YL06 - มหาดไทย",
  "YL07 - ลาดพร้าว 101", "YL08 - บางกะปิ", "YL09 - แยกลำสาลี",
  "YL10 - ศรีกรีฑา", "YL11 - หัวหมาก", "YL12 - กลันตัน", "YL13 - ศรีนุช",
  "YL14 - ศรีนครินทร์ 38", "YL15 - สวนหลวง ร. 9", "YL16 - ศรีอุดม",
  "YL17 - ศรีเอี่ยม", "YL18 - ศรีลาซาล", "YL19 - ศรีแบริ่ง",
  "YL20 - ศรีด่าน", "YL21 - ศรีเทพา", "YL22 - ทิพวัล", "YL23 - สำโรง",
  "PK01 - ศูนย์ราชการนนทบุรี", "PK02 - แคราย", "PK03 - สนามบินน้ำ",
  "PK04 - สามัคคี", "PK05 - กรมชลประทาน", "PK06 - แยกปากเกร็ด",
  "PK07 - เลี่ยงเมืองปากเกร็ด", "PK08 - แจ้งวัฒนะ-ปากเกร็ด 28",
  "PK09 - สถานีศรีรัช", "PK10 - เมืองทองธานี", "PK11 - แจ้งวัฒนะ 14",
  "PK12 - ศูนย์ราชการเฉลิมพระเกียรติ", "PK13 - โทรคมนาคมแห่งชาติ",
  "PK14 - หลักสี่", "PK15 - ราชภัฎพระนคร", "PK16 - วัดพระศรีมหาธาตุ",
  "PK17 - รามอินทรา 3", "PK18 - ลาดปลาเค้า", "PK19 - รามอินทรา กม. 4",
  "PK20 - มัยลาภ", "PK21 - วัชรพล", "PK22 - รามอินทรา กม. 6",
  "PK23 - คู้บอน", "PK24 - รามอินทรา กม. 9", "PK25 - วงแหวนรามอินทรา",
  "PK26 - นพรัตน์", "PK27 - บางชัน", "PK28 - เศรษฐบุตรบำเพ็ญ",
  "PK29 - ตลาดมีนบุรี", "PK30 - มีนบุรี", "PKS01 - อิมแพคชาเลนเจอร์",
  "PKS02 - ทะเลสาบเมืองทองธานี",
];

// ARL rows are formatted "สถานี<name> (A1)" in the sheet.
const ARL = [
  "สถานีสุวรรณภูมิ (A1)", "สถานีลาดกระบัง (A2)", "สถานีบ้านทับช้าง (A3)",
  "สถานีหัวหมาก (A4)", "สถานีรามคำแหง (A5)", "สถานีมักกะสัน (A6)",
  "สถานีราชปรารภ (A7)", "สถานีพญาไท (A8)",
];

const SLA_RULES = [
  // Listing follow-up by potential (days until overdue)
  ["listing_follow", "A", 15],
  ["listing_follow", "B", 30],
  ["listing_follow", "C", 60],
  ["listing_follow", "Exclusive", 7],
  // Listing post-freshness (วันที่ Follow, col O)
  ["listing_post", "A", 14],
  ["listing_post", "B", 30],
  ["listing_post", "C", 30],
  ["listing_post", "Exclusive", 7],
  // Lead follow-up by potential
  ["lead_follow", "A", 3],
  ["lead_follow", "B", 7],
  ["lead_follow", "C", 14],
] as const;

function parseDashStation(raw: string): { code: string; name: string } {
  const idx = raw.indexOf(" - ");
  return { code: raw.slice(0, idx).trim(), name: raw.slice(idx + 3).trim() };
}

async function main() {
  const db = getDb();

  const stations = [
    ...BTS.map((raw) => ({ type: "BTS" as const, ...parseDashStation(raw) })),
    ...MRT.map((raw) => ({ type: "MRT" as const, ...parseDashStation(raw) })),
    ...ARL.map((raw) => {
      const m = raw.match(/^(.*)\s+\((A\d+)\)$/);
      if (!m) throw new Error(`Unparseable ARL station: ${raw}`);
      return { type: "ARL" as const, code: m[2], name: m[1].trim() };
    }),
  ];
  await db
    .insert(transitStations)
    .values(stations)
    .onConflictDoNothing({
      target: [transitStations.type, transitStations.code],
    });
  console.log(
    `transit_stations: ${stations.length} seeded (BTS ${BTS.length} · MRT ${MRT.length} · ARL ${ARL.length})`
  );

  await db
    .insert(slaRules)
    .values(
      SLA_RULES.map(([entity, potential, maxDays]) => ({
        entity,
        potential,
        maxDays,
      }))
    )
    .onConflictDoNothing({ target: [slaRules.entity, slaRules.potential] });
  console.log(`sla_rules: ${SLA_RULES.length} seeded`);
}

main().then(() => process.exit(0));
