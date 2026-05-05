// @ts-nocheck
import { useState, useEffect } from 'react';

// ===================== DATA =====================
const DATA = [
  {
    id: 1,
    emoji: '🛡️',
    title: 'Shaxsiy Xavfsizlik',
    desc: 'SHHVlar, sinov muddatlari, xavfsizlik belgilari',
    color: '#FF6B35',
    dark: '#3D1205',
    lessons: [
      {
        id: '1.1',
        title: 'SHHV va ularni tanlash',
        emoji: '🧤',
        xp: 50,
        slides: [
          {
            head: 'Uchta asosiy xavf',
            items: [
              '⚡ Elektr toki urishi (bevosita yoki yoy)',
              '🔥 Elektr yoyi — juda yuqori harorat',
              '💥 Mexanik shikastlanishlar (balandlik, zarba)'
            ]
          },
          {
            head: '5 ta asosiy SHHV',
            items: [
              '🪖 Kaska — tok va mexanik zarbadan',
              "🧤 Dielektrik qo'lqop — 1000 V gacha",
              '👔 Kombinezon — faqat paxta (X/B) matosi',
              "👓 Ko'zoynagi — yoy chaqnashidan",
              '🥾 Dielektrik botinka — qadam kuchlanishidan'
            ]
          },
          {
            head: '⚠️ Muhim qoida!',
            warn: true,
            items: [
              "Dielektrik qo'lqoplarning sinov muddati 6 oyda 1 marta.",
              "Shtampi yo'q yoki muddati o'tgan qo'lqopdan foydalanish O'LIM BILAN BAROBAR!"
            ]
          }
        ],
        qs: [
          {
            q: "110 kVli podstansiyada ishlash uchun qaysi qo'lqop mos?",
            opts: [
              "Oddiy qurilish qo'lqopi",
              "Rezina xo'jalik qo'lqopi",
              "EN belgili dielektrik qo'lqop",
              "Charm qo'lqop"
            ],
            a: 2,
            exp: "Faqat EN belgili dielektrik qo'lqop yuqori kuchlanishdan himoya qiladi."
          },
          {
            q: 'Sintetik kiyimda podstansiyaga kirish mumkin.',
            tf: true,
            a: false,
            exp: "Sintetika elektr yoyida erib, badanga yopishib qoladi — og'ir kuyishga olib keladi."
          },
          {
            q: "Qo'lqopda kichik teshik topildi. Nima qilasiz?",
            opts: [
              'Izolenta bilan yopib ishlayman',
              "Teshik kichkina — xavfi yo'q",
              "Foydalanishni darhol to'xtataman",
              "Ustidan yana bir qo'lqop kiyaman"
            ],
            a: 2,
            exp: 'Har qanday shikastlangan SHHV yaroqsiz deb hisoblanadi — almashtirish shart!'
          }
        ]
      },
      {
        id: '1.2',
        title: 'Sinov muddatlari',
        emoji: '📅',
        xp: 60,
        slides: [
          {
            head: "Himoya vositalari 2 turga bo'linadi",
            items: [
              "🔵 Asosiy: kuchlanishga to'liq bardosh (shtanga, indikator, kleschi)",
              "⚪ Qo'shimcha: asosiy bilan birga ishlatiladi (botinka, gilamcha, qo'lqop)"
            ]
          },
          {
            head: 'Sinov muddatlari jadvali',
            items: [
              "🧤 Dielektrik qo'lqop → 6 oy",
              '📏 Kuchlanish indikatori → 12 oy',
              '🪄 Operativ shtanga → 24 oy',
              '✂️ Izolyatsiyalovchi kleschi → 24 oy',
              '🥾 Dielektrik botinka → 36 oy'
            ]
          },
          {
            head: '⚠️ Navbatdan tashqari sinov!',
            warn: true,
            items: [
              "Vosita yerga tushgan, mexanik shikastlangan yoki nam bo'lsa —",
              "Muddatidan qat'iy nazar, darhol sinovdan o'tkaziladi!"
            ]
          }
        ],
        qs: [
          {
            q: "Dielektrik qo'lqop qancha vaqtda sinovdan o'tadi?",
            opts: ['3 oyda bir', '6 oyda bir', '12 oyda bir', '24 oyda bir'],
            a: 1,
            exp: "Qo'lqoplar 6 oyda bir marta suvli vannada yuqori kuchlanish bilan sinovdan o'tkaziladi."
          },
          {
            q: "Gilamchalar 6 oyda laboratoriya sinovidan o'tkazilishi shart.",
            tf: true,
            a: false,
            exp: "Gilamchalar laboratoriyada emas — har foydalanishdan oldin ko'zdan kechiriladi."
          },
          {
            q: "Sinov muddati tugamagan qo'lqop yerga tushib ketdi. Nima qilasiz?",
            opts: [
              'Hech narsa — muddati bor',
              'Faqat quritib ishlatayman',
              'Navbatdan tashqari sinovga topshiraman',
              '1 oy kutaman'
            ],
            a: 2,
            exp: "Mexanik zarba izolyatsiyani shikastlashi mumkin — sinovdan o'tkazish majburiy!"
          }
        ]
      },
      {
        id: '1.3',
        title: 'Xavfsizlik plakatlari',
        emoji: '🚨',
        xp: 55,
        slides: [
          {
            head: '4 ta plakat guruhi',
            items: [
              "🔴 Taqiqlovchi (Qizil/Oq): 'YOQMANG! Odamlar ishlayapti'",
              "🟡 Ogohlantiruvchi (Sariq/Qora): 'TO'XTANG! Kuchlanish'",
              "🔵 Buyuruvchi (Ko'k/Oq): 'SHU YERDA ISHLANG'",
              "🟢 Ko'rsatuvchi (Yashil/Oq): 'YERLATILGAN'"
            ]
          },
          {
            head: 'Plakatlarni ilish qoidalari',
            items: [
              '📌 Faqat ish davomida — tugagach darhol olinadi',
              "👁️ Ko'z darajasida — hamma ko'rishi shart",
              "🏗️ Metall podstansiyada plastik/yog'och material"
            ]
          },
          {
            head: '⚠️ Eng muhim plakat!',
            warn: true,
            items: [
              "'YOQMANG! Odamlar ishlayapti' plakatini —",
              "Faqat uni ILGAN XODIMNING O'ZI olishi mumkin!",
              'Bosh muhandis ham, direktor ham — HAQLI EMAS!'
            ]
          }
        ],
        qs: [
          {
            q: "'TO'XTANG! Kuchlanish' plakati qaysi guruhga kiradi?",
            opts: [
              'Taqiqlovchi',
              'Ogohlantiruvchi',
              'Buyuruvchi',
              "Ko'rsatuvchi"
            ],
            a: 1,
            exp: 'Sariq plakatlar — ogohlantiruvchi guruh. Xavf haqida ogohlantiradi.'
          },
          {
            q: "Dispetcher 'YOQMANG' plakatini olishni buyurdi. Siz nima qilasiz?",
            opts: [
              'Darhol olaman',
              'Ish rahbariga aytaman',
              'Rad etaman — faqat ilgan kishi olishi mumkin',
              '10 daqiqa kutaman'
            ],
            a: 2,
            exp: 'Bu plakatni faqat uni ilgan xodim olishi mumkin — bu qonuniy norma!'
          },
          {
            q: "Yerlatgich o'rnatilgan joyga qaysi plakat ilinadi?",
            opts: ['YOQMANG!', "TO'XTANG!", 'SHU YERDA ISHLANG', 'YERLATILGAN'],
            a: 3,
            exp: "Yashil 'YERLATILGAN' — ko'rsatuvchi guruh, xavfsiz holatni bildiradi."
          }
        ]
      }
    ]
  },
  {
    id: 2,
    emoji: '🏭',
    title: 'Podstansiya Qoidalari',
    desc: 'Naryad, xavfsiz masofalar, harakatlanish qoidalari',
    color: '#1A91DA',
    dark: '#021529',
    lessons: [
      {
        id: '2.1',
        title: 'Naryad va Farmoyish',
        emoji: '📋',
        xp: 65,
        slides: [
          {
            head: 'Ish ruxsatining 3 turi',
            items: [
              '📝 Naryad-ruxsatnoma: yozma topshiriq, murakkab ishlar uchun',
              "📞 Farmoyish: og'zaki/yozma tezkor buyruq, oddiy ishlar",
              "📋 Joriy ekspluatatsiya: doimiy mayda ishlar ro'yxati"
            ]
          },
          {
            head: 'Naryadning 7 ta majburiy elementi',
            items: [
              '1. Ish joyi (aniq)  2. Boshlanish/tugash vaqti',
              '3. Ruxsat beruvchi  4. Ish rahbari',
              '5. Brigada tarkibi  6. Xavfsizlik tadbirlari',
              '7. Ikki taraf imzosi'
            ]
          },
          {
            head: 'Naryad muddatlari',
            items: [
              '⏰ Amal qilish: 15 kalendar kuni',
              '🔄 Uzaytirish: faqat 1 marta (yana 15 kun)',
              '📄 Nusxa soni: 2 ta',
              '📁 Saqlash muddati: 30 kun'
            ]
          }
        ],
        qs: [
          {
            q: 'Uch kunlik kabel almashtirish uchun qaysi hujjat kerak?',
            opts: [
              'Farmoyish',
              'Joriy ekspluatatsiya',
              'Naryad-ruxsatnoma',
              "Og'zaki ruxsat"
            ],
            a: 2,
            exp: "Murakkab, ko'p vaqt talab etadigan ishlar uchun naryad-ruxsatnoma talab etiladi."
          },
          {
            q: 'Naryad-ruxsatnoma necha kun amal qiladi?',
            opts: ['7 kun', '10 kun', '15 kun', '30 kun'],
            a: 2,
            exp: 'Naryad 15 kalendar kuni amal qiladi, faqat 1 marta uzaytirish mumkin.'
          },
          {
            q: 'Naryadni ikki marta uzaytirish mumkin.',
            tf: true,
            a: false,
            exp: 'Naryadni faqat bir marta, yana 15 kungacha uzaytirish mumkin.'
          }
        ]
      },
      {
        id: '2.2',
        title: 'Xavfsiz masofalar',
        emoji: '📏',
        xp: 70,
        slides: [
          {
            head: 'Elektr yoyi xavfi',
            items: [
              '⚡ Simga tegish shart emas — havo orqali yoy sakraydi!',
              '📈 Kuchlanish qanchalik yuqori → masofa shunchalik katta',
              "☠️ 'Flashover' — elektr yoyi hodisasi bir zumda sodir bo'ladi"
            ]
          },
          {
            head: 'Minimal xavfsiz masofalar',
            items: [
              '1 kV gacha → 0.3 m  |  1–35 kV → 0.6 m',
              '110 kV → 1.0 m  |  220 kV → 2.0 m',
              '500 kV → 3.5 m  |  750 kV → 5.0 m'
            ]
          },
          {
            head: '⚠️ Qadam kuchlanishi!',
            warn: true,
            items: [
              'Yerga tushgan sim atrofida 8 metr xavfli zona!',
              'Harakat: kichik qadamlar yoki bir oyoq usulida uzoqlashing.',
              "Yugurish va sakrash qat'iyan taqiqlangan!"
            ]
          }
        ],
        qs: [
          {
            q: '220 kVli qurilmada minimal xavfsiz masofa necha metr?',
            opts: ['1.0 metr', '1.5 metr', '2.0 metr', '3.5 metr'],
            a: 2,
            exp: '220 kV uchun minimal xavfsiz masofa — 2.0 metr.'
          },
          {
            q: 'Yerga tushgan simga faqat tegib ketganda xavf yuzaga keladi.',
            tf: true,
            a: false,
            exp: 'Qadam kuchlanishi tufayli 8 metr masofada ham kuchlanish xavfli!'
          },
          {
            q: '35 kVli sim yerga tushib yotibdi. Necha metrdan yaqin bormaslik kerak?',
            opts: ['3 metr', '5 metr', '8 metr', '10 metr'],
            a: 2,
            exp: 'Yerga tushgan istalgan kuchlanishli sim atrofida 8 metr xavfli zona.'
          }
        ]
      },
      {
        id: '2.3',
        title: 'Harakatlanish qoidalari',
        emoji: '🚶',
        xp: 55,
        slides: [
          {
            head: '3 xil kirish zonasi',
            items: [
              "🟢 Erkin zona: ma'muriy binolar — hamma kiradi",
              "🟡 Nazorat zona: elektr guruhi bo'lgan xodimlar",
              '🔴 Cheklangan zona: faqat ruxsat etilgan brigada'
            ]
          },
          {
            head: 'Asosiy qoidalar',
            items: [
              "🛤️ Faqat yo'laklar bo'ylab yuring",
              '🚪 Shkaf eshiklarini doim yopiq tuting',
              "👫 Yolg'iz kirish — TAQIQLANGAN!",
              '🚫 Yugurish man etilgan (avariyada ham)'
            ]
          },
          {
            head: '⚠️ Eng xavfli odat!',
            warn: true,
            items: [
              "'Men avval ko'rib kelaman' — eng xavfli fikr!",
              "III guruhli xodim ham yolg'iz kirishi TAQIQLANADI!",
              "Ko'p avariyalar aynan shu sababdan yuz bergan."
            ]
          }
        ],
        qs: [
          {
            q: "II guruhli xodim yolg'iz 110 kVli ORU ga kirishi mumkinmi?",
            opts: [
              'Ha, ruxsat bor',
              'Kechqurun mumkin',
              "Yo'q — navbatchi bilan kirish kerak",
              "V guruh bo'lsa mumkin"
            ],
            a: 2,
            exp: "Istalgan guruhli xodim yolg'iz podstansiyaga kirishi taqiqlanadi."
          },
          {
            q: 'Avariya holatida yugurish mumkin.',
            tf: true,
            a: false,
            exp: 'Avariyada ham xotirjam va ehtiyotkorlik bilan yurish kerak.'
          },
          {
            q: 'Shkaf eshiklarini qanday holatda tutish kerak?',
            opts: ['Ochiq', 'Yopiq', 'Yarim ochiq', 'Farq qilmaydi'],
            a: 1,
            exp: 'Ochiq shkaf — kuchlanish ostidagi qismlarga tasodifan tegib qolish xavfi.'
          }
        ]
      }
    ]
  },
  {
    id: 3,
    emoji: '⚡',
    title: 'Texnik Tadbirlar',
    desc: 'Ish joyini tayyorlashning 5 oltin qoidasi',
    color: '#2BC48A',
    dark: '#022C1A',
    lessons: [
      {
        id: '3.1',
        title: "Kuchlanishni o'chirish",
        emoji: '🔌',
        xp: 75,
        slides: [
          {
            head: "To'g'ri o'chirish tartibi",
            items: [
              '1️⃣ Yukni kamaytirish',
              "2️⃣ Ajratgich (выключатель) o'chirish",
              '3️⃣ Razedinitelni ochish',
              '4️⃣ Blokirovka qilish + plakat ilish'
            ]
          },
          {
            head: "'Barcha tomonlardan o'chirish' tamoyili",
            items: [
              '🔄 Asosiy liniya kuchlanishi',
              '🔄 Zaxira manbadan kuchlanish',
              '🔄 Transformatorning teskari tarafidan kuchlanish',
              "⚠️ Har bir manbani ALOHIDA o'chirish shart!"
            ]
          },
          {
            head: "🔴 O'ldiruvchi xato!",
            warn: true,
            items: [
              "Avval razedinitelni ochib, keyin ajratgichni o'chirish MUMKIN EMAS!",
              'Razedinitel yuk ostida ochilmaydi — bu kuchli yoy hosil qiladi.',
              "Bu xato o'lim bilan tugashi mumkin!"
            ]
          }
        ],
        qs: [
          {
            q: "Kuchlanishni o'chirishning to'g'ri tartibi qaysi?",
            opts: [
              'Razedinitel → Ajratgich',
              'Ajratgich → Razedinitel',
              'Istalgan tartibda',
              'Blokirovka → Razedinitel'
            ],
            a: 1,
            exp: "Avval ajratgich, so'ng razedinitel. Aksincha — o'ldiruvchi xato!"
          },
          {
            q: 'Ish joyiga kuchlanish faqat bitta tomondan keladi.',
            tf: true,
            a: false,
            exp: 'Kuchlanish asosiy, zaxira manba va transformator teskari tarafidan kelishi mumkin.'
          },
          {
            q: "'YOQMANG! Odamlar ishlayapti' plakati qayerga ilinadi?",
            opts: [
              'Ish joyiga',
              'Blokirovka qilingan klyuchga',
              'Yerlatgich yoniga',
              'Kirish eshigiga'
            ],
            a: 1,
            exp: 'Plakat — blokirovka qilingan klyuch dastasiga ilinadi.'
          }
        ]
      },
      {
        id: '3.2',
        title: "Kuchlanish yo'qligini tekshirish",
        emoji: '🔍',
        xp: 70,
        slides: [
          {
            head: 'Nima uchun tekshirish shart?',
            items: [
              "🔧 Texnik nosozlik bo'lishi mumkin",
              "👤 Inson xatosi bo'lishi mumkin",
              "⚡ Boshqa manba kuchlanish bergan bo'lishi mumkin",
              "📋 Qoida: tekshirmasdan ishlash = o'lim xavfi!"
            ]
          },
          {
            head: 'Tekshirish algoritmi (3 qadam)',
            items: [
              "1️⃣ Ko'rsatkichni kuchlanish BOR simda sinash",
              '2️⃣ A, B, C — uchala fazani ketma-ket tekshirish',
              '3️⃣ Yana kuchlanish bor simda ishlashini tasdiqlash'
            ]
          },
          {
            head: '⚠️ Eng xavfli yanglishish!',
            warn: true,
            items: [
              "Ko'rsatkich batareyasi tugagan bo'lishi mumkin!",
              "Signal bermadi ≠ kuchlanish yo'q.",
              "Tekshirishdan OLDIN ham, KEYIN ham sinab ko'ring!"
            ]
          }
        ],
        qs: [
          {
            q: 'Kuchlanish tekshirishda birinchi qadam nima?',
            opts: [
              'A fazasini tekshirish',
              "Ko'rsatkichni kuchlanish bor simda sinash",
              "Yerlatgich o'rnatish",
              'Plakat ilish'
            ],
            a: 1,
            exp: "Ko'rsatkich ishlayotganini tekshirish uchun avval kuchlanish bor simda sinab ko'riladi."
          },
          {
            q: "Ko'rsatkich uchala fazada signal bermasa, darhol yerlatgich o'rnatish mumkin.",
            tf: true,
            a: false,
            exp: "Signal bermadi — bu ko'rsatkich ishlamayotgani bo'lishi mumkin! Yana sinab ko'ring."
          },
          {
            q: "Necha fazada kuchlanish yo'qligi tekshiriladi?",
            opts: ['1 faza', '2 faza', '3 faza (A, B, C)', '4 faza'],
            a: 2,
            exp: "Uchala fazada ham kuchlanish yo'qligini alohida tekshirish shart."
          }
        ]
      },
      {
        id: '3.3',
        title: 'Yerlatish (Zazemleniye)',
        emoji: '🌍',
        xp: 80,
        slides: [
          {
            head: "Nima uchun yerlatgich o'rnatiladi?",
            items: [
              '🔄 Boshqa brigada tasodifan kuchlanish bersa',
              '📡 Yaqin liniya induksiya hosil qilsa',
              "⚡ Statik zaryad to'plansa",
              '🛡️ Yerlatgich zaryadni yerga olib ketadi'
            ]
          },
          {
            head: "O'RNATISH tartibi (oltin qoida)",
            items: [
              '1️⃣ ER shinasiga ulang',
              '2️⃣ Faza A ga ulang',
              '3️⃣ Faza B ga ulang',
              '4️⃣ Faza C ga ulang',
              '🔴 Tamoyil: Avval YER — keyin FAZA!'
            ]
          },
          {
            head: 'YECHISH tartibi (teskarisi!)',
            items: [
              '1️⃣ Faza C ni uzing',
              '2️⃣ Faza B ni uzing',
              '3️⃣ Faza A ni uzing',
              '4️⃣ ER shinasidan uzing',
              '🔴 Tamoyil: Avval FAZA — keyin YER!'
            ]
          }
        ],
        qs: [
          {
            q: "Yerlatgich o'rnatishda birinchi ulash tartibi qaysi?",
            opts: ['Faza A', 'Faza B', 'ER shinasi', 'Faza C'],
            a: 2,
            exp: 'Avval ER shinasiga, keyin fazalarga (A → B → C) ulanadi.'
          },
          {
            q: 'Yerlatgichni yechishda avval ER shinasidan uzish kerak.',
            tf: true,
            a: false,
            exp: 'Yechishda tartib: C → B → A → ER shinasi. ER — eng oxirgi!'
          },
          {
            q: "Ko'chma yerlatgich mis kesimi minimal qancha bo'lishi kerak?",
            opts: ['10 mm²', '16 mm²', '25 mm²', '35 mm²'],
            a: 2,
            exp: "25 mm² dan kam bo'lsa, qisqa tutashuv toki simni yoqib yuborishi mumkin."
          }
        ]
      },
      {
        id: '3.4',
        title: "To'siqlar va Plakatlar",
        emoji: '⛔',
        xp: 60,
        slides: [
          {
            head: "To'siq turlari",
            items: [
              "🔶 Izolyatsiyalangan to'siq — kuchlanish yaqinida ishlanganda",
              '🟡 Saqlash lentasi — xavfli zonani belgilash (sariq-qora)',
              "🟦 Ko'chma panel — hajmli xavfli zona uchun"
            ]
          },
          {
            head: 'Ish joyini tayyorlashda 4 plakat',
            items: [
              "🔴 Klyuchga: 'YOQMANG! Odamlar ishlayapti'",
              "🟡 Kuchlanish yoniga: 'TO'XTANG! Kuchlanish'",
              "🔵 Ish joyiga: 'SHU YERDA ISHLANG'",
              "🟢 Yerlatgich yoniga: 'YERLATILGAN'"
            ]
          },
          {
            head: "⚠️ To'siq qoidasi!",
            warn: true,
            items: [
              "To'siqni faqat ISHGA RUXSAT BERUVCHI o'zgartirishi mumkin!",
              "Xodim o'z ixtiyori bilan to'siqni siljitsa —",
              'NARYAD BEKOR QILINADI!'
            ]
          }
        ],
        qs: [
          {
            q: "To'siqni vaqtincha xodimning o'zi ko'chirishi mumkinmi?",
            opts: [
              "Ha, tez qaytarsa bo'ladi",
              "Yo'q — faqat ruxsat beruvchi",
              "Ha, ish rahbaridan so'rab",
              'Ha, ehtiyotkorlik bilan'
            ],
            a: 1,
            exp: "To'siqni faqat ishga ruxsat beruvchi o'zgartira oladi — boshqasi emas!"
          },
          {
            q: "'SHU YERDA ISHLANG' plakati qaysi rangda?",
            opts: ['Qizil', 'Sariq', "Ko'k", 'Yashil'],
            a: 2,
            exp: "Ko'k — buyuruvchi guruh. Ruxsat etilgan ish joyini ko'rsatadi."
          },
          {
            q: 'Ish tugagach plakatlarni kim olishi mumkin?',
            opts: [
              'Ish rahbari',
              'Istalgan xodim',
              'Faqat ishga ruxsat beruvchi',
              'Navbatchi dispetcher'
            ],
            a: 2,
            exp: 'Plakatlarni faqat ishga ruxsat beruvchi olishi mumkin, ish rahbari emas.'
          }
        ]
      },
      {
        id: '3.5',
        title: '5 Oltin Qoidani takrorlash',
        emoji: '🏆',
        xp: 90,
        slides: [
          {
            head: '5 oltin qoidani eslang!',
            items: [
              "1️⃣ Kuchlanishni o'chirish — BARCHA tomonlardan",
              "2️⃣ Kuchlanish yo'qligini tekshirish — ko'rsatkich bilan",
              '3️⃣ Yerlatish — ER → Faza tartibida',
              "4️⃣ To'siqlar o'rnatish — ruxsat beruvchi tomonidan",
              "5️⃣ Plakatlar ilish — to'g'ri joyga, to'g'ri plakat"
            ]
          },
          {
            head: 'Tartib buzilmasin!',
            items: [
              "❌ Bitta qadamni o'tkazib yuborish = HAYOT XAVFI",
              '✅ Barcha 5 qadamni bajarish = XAVFSIZ ish',
              '📋 Bu qoidalar qonun kuchiga ega — majburiy!'
            ]
          }
        ],
        qs: [
          {
            q: "Kuchlanish tekshirishdan oldin yerlatgich o'rnatish mumkinmi?",
            opts: [
              'Ha, tartib muhim emas',
              "Yo'q — avval kuchlanish tekshiriladi",
              'Ha, xavfli emas',
              'Ish rahbari xohlagancha qiladi'
            ],
            a: 1,
            exp: "Avval kuchlanish yo'qligi tekshiriladi, so'ngra yerlatgich o'rnatiladi."
          },
          {
            q: "5 oltin qoidadan bittasini o'tkazib yuborish xavfsiz.",
            tf: true,
            a: false,
            exp: "Har bir qadam hayot-mamot masalasi. Birini o'tkazib yuborish o'limga olib kelishi mumkin."
          },
          {
            q: 'Yerlatgich yechishda OXIRGI qadam qaysi?',
            opts: [
              'Faza A ni uzish',
              'Faza C ni uzish',
              'ER shinasidan uzish',
              'Plakat olish'
            ],
            a: 2,
            exp: 'Yechish tartibi: C → B → A → ER shinasi. ER eng oxirgi uziladi.'
          }
        ]
      }
    ]
  },
  {
    id: 4,
    emoji: '🚑',
    title: 'Favqulodda Vaziyatlar',
    desc: "Birinchi yordam, balandlik, yong'in xavfsizligi",
    color: '#E74C3C',
    dark: '#2D0000',
    lessons: [
      {
        id: '4.1',
        title: 'Tok urishida birinchi yordam',
        emoji: '💊',
        xp: 85,
        slides: [
          {
            head: '⚠️ Birinchi qoida!',
            warn: true,
            items: [
              "Jabrlanuvchiga YALANG'OCH QO'L BILAN TEGMANG!",
              "Tok hali o'tib turgan bo'lsa — siz ham urilasiz!",
              "Avval xavfsiz ajratish usulini qo'llang!"
            ]
          },
          {
            head: 'Tokdan ajratish usullari',
            items: [
              "🔌 Klyuch yaqinda → darhol o'chiring",
              '🪵 Quruq tayoq bilan simni surting',
              "👕 Quruq kiyimdan (yoqa) bir qo'llib torting",
              "🔝 Balandda → avval kuchlanishni o'chiring"
            ]
          },
          {
            head: 'YOR — 6 qadam algoritmi',
            items: [
              "1. Tokdan ajrating  2. Xavfsiz joyga o'tkaring",
              '3. Hushini tekshiring  4. Nafas tekshiring (10s)',
              "5. 112 ga qo'ng'iroq  6. YOR: 30 siqish + 2 nafas"
            ]
          }
        ],
        qs: [
          {
            q: 'Jabrlanuvchini tokdan ajratishda birinchi harakat qaysi?',
            opts: [
              "Darhol qo'lidan ushling",
              'Klyuch/tayoq bilan xavfsiz ajrating',
              "112 ga qo'ng'iroq qiling",
              'YOR boshlang'
            ],
            a: 1,
            exp: 'Avval xavfsiz usulda tokdan ajratiladi — aks holda siz ham urilasiz!'
          },
          {
            q: 'YOR nisbati 30:2 degani: 30 siqish + 2 nafas.',
            tf: true,
            a: true,
            exp: "To'g'ri! 30 marta ko'krak siqish + 2 marta sun'iy nafas = 1 sikl YOR."
          },
          {
            q: 'Jabrlanuvchi hushida va nafas olmoqda. YOR boshlansinmi?',
            opts: [
              'Ha, ehtiyot uchun',
              "Yo'q — 112 chaqirib kuting",
              'Ha, 10 daqiqa davom eting',
              "Yo'q, faqat suv bering"
            ],
            a: 1,
            exp: "YOR faqat nafas olmayotgan va yuragi to'xtagan paytda boshlanadi."
          }
        ]
      },
      {
        id: '4.2',
        title: 'Balandlikda ishlash',
        emoji: '🏗️',
        xp: 65,
        slides: [
          {
            head: "Balandlikda ishlash ta'rifi",
            items: [
              '📏 1.8 metr va undan yuqori → balandlik ishi!',
              '🔒 Xavfsizlik kamari (poyasi) — majburiy',
              '👥 Ikkinchi xodim pastda turishi — majburiy',
              '📋 Maxsus ruxsat talab etiladi'
            ]
          },
          {
            head: 'Narvon qoidalari',
            items: [
              '📐 Burchak: 70–75 daraja',
              '🤝 Tag: ikkinchi xodim ushlab turadi',
              "⬆️ Eng yuqori pog'ona: tepadan 3-chi",
              "🙌 Doim ikki qo'l narvonda — asbob bitta qo'lda"
            ]
          },
          {
            head: 'Kamar mahkamlanish qoidasi',
            items: [
              "🔗 Karabin nuqtasi: beldan YUQORIDA bo'lishi shart!",
              '⬇️ Karabin past → yiqilganda katta zarba',
              "🚫 Shamol, tuman, yomg'ir, yolg'izlikda — TAQIQLANGAN"
            ]
          }
        ],
        qs: [
          {
            q: 'Balandlikda ishlash qaysi balandlikdan boshlanadi?',
            opts: ['1.0 metr', '1.5 metr', '1.8 metr', '2.0 metr'],
            a: 2,
            exp: '1.8 metr va undan yuqori — maxsus qoidalar va kamar majburiy.'
          },
          {
            q: "Narvon burchagi 60 daraja bo'lsa ishlash mumkin.",
            tf: true,
            a: false,
            exp: "Narvon burchagi 70–75 daraja bo'lishi shart. 60 daraja — sirg'anish xavfi."
          },
          {
            q: 'Xavfsizlik kamari karabini qayerga mahkamlanishi kerak?',
            opts: ['Belga', 'Beldan pastga', 'Beldan yuqoriga', 'Qulay joyga'],
            a: 2,
            exp: 'Karabin qanchalik yuqori mahkamlansa, yiqilish masofasi shunchalik kam.'
          }
        ]
      },
      {
        id: '4.3',
        title: "Yong'inni o'chirish",
        emoji: '🔥',
        xp: 75,
        slides: [
          {
            head: '🔴 Asosiy qoida!',
            warn: true,
            items: [
              "Kuchlanish ostidagi uskunalarni SUV BILAN O'CHIRIB BO'LMAYDI!",
              "Suv — elektr o'tkazuvchi. Tok siz orqali o'tadi!",
              "Avval kuchlanishni o'chiring — keyin o'chirishni boshlang!"
            ]
          },
          {
            head: "Yong'in o'chirgichlar taqqosi",
            items: [
              "❌ Suv (OV): faqat o'chirilgan qurilma",
              "❌ Ko'pik (OP): kuchlanishda taqiqlangan",
              '✅ Kukun (OP): 1 kV gacha',
              '✅ CO₂ (OU): 10 kV gacha — elektr uchun asosiy',
              '✅ Aerozol: yuqori kuchlanishli transformer'
            ]
          },
          {
            head: "To'g'ri harakat algoritmi",
            items: [
              '1️⃣ Xavfsiz masofaga cheking',
              "2️⃣ Dispetcherga xabar: kuchlanishni o'ching!",
              "3️⃣ Kuchlanish o'chirilganini tekshiring",
              "4️⃣ O'chirishni boshlang",
              "5️⃣ 101 (Yong'in xizmati) ga qo'ng'iroq qiling"
            ]
          }
        ],
        qs: [
          {
            q: '110 kVli transformer yonyapti. Birinchi harakat qaysi?',
            opts: [
              "CO₂ bilan o'chirishni boshlayman",
              'Suv purkashni boshlayman',
              "Dispetcherdan kuchlanishni o'chirtiraman",
              "101 ga qo'ng'iroq qilaman"
            ],
            a: 2,
            exp: "Avval kuchlanish o'chirilmasa, istalgan vosita bilan o'chirish xavfli!"
          },
          {
            q: "CO₂ o'chirgich bilan kuchlanish ostidagi qurilmaga 0.5 m yaqin ishlash mumkin.",
            tf: true,
            a: false,
            exp: "CO₂ o'chirgich bilan minimal masofa — 1 metr!"
          },
          {
            q: "Server xonasida yong'in. Qaysi o'chirgich ishlatiladi?",
            opts: [
              'Suv bilan',
              "Ko'pik bilan",
              'CO₂ (OU) bilan',
              "Istalgan o'chirgich"
            ],
            a: 2,
            exp: "Server xonasi uchun CO₂ o'chirgich — elektronikani buzmasdan o'chiradi."
          }
        ]
      },
      {
        id: '4.4',
        title: 'Kimyoviy xavflar',
        emoji: '☣️',
        xp: 70,
        slides: [
          {
            head: 'Podstansiyalardagi kimyoviy xavflar',
            items: [
              "🛢️ Transformer yog'i → yong'in + teri kuyishi",
              '🧪 Sulfat kislota (akkumulator) → kimyoviy kuyish',
              '💨 Vodorod gazi (akkumulator xonasi) → portlash!',
              "💨 SF₆ gazi (gaz izolyatsiya) → bo'g'ilish xavfi"
            ]
          },
          {
            head: 'Akkumulyator xonasi qoidalari',
            items: [
              '⏱️ Kirish: 15 daqiqa OLDIN shamollatish yoqiladi',
              '🚫 Olov va uchqun taqiqlanadi',
              "👓 Kislotaga chidamli ko'zoynaklar kerak",
              '⚡ Faqat portlashga chidamli qurilmalar'
            ]
          },
          {
            head: 'SF₆ gaz chiqishi',
            items: [
              "☠️ SF₆ — og'ir gaz, yer sathida to'planadi",
              "🫁 Kislorodni siqib chiqaradi — bo'g'ilish",
              '🛡️ Oddiy niqob YORDAM BERMAYDI!',
              '✅ Faqat kislorod apparati (izolyatsiyalovchi)'
            ]
          }
        ],
        qs: [
          {
            q: 'Akkumulyator xonasiga kirishdan oldin nima majburiy?',
            opts: [
              'Gaz niqobi kiyish',
              '15 daqiqa avval shamollatish',
              "Kislota o'chirgich olib kirish",
              "Yolg'iz kirmaslik"
            ],
            a: 1,
            exp: "Vodorod gazi to'planishi mumkin — 15 daqiqa avval shamollatish tizimi yoqiladi."
          },
          {
            q: "SF₆ gaz chiqishi bo'lgan xonada oddiy niqob bilan ishlash mumkin.",
            tf: true,
            a: false,
            exp: 'SF₆ kislorodni siqib chiqaradi — faqat kislorod apparati (izolyatsiyalovchi) ishlaydi.'
          },
          {
            q: "Transformer yog'i yong'ini uchun qaysi o'chirgich qo'llaniladi?",
            opts: [
              'Suv',
              "Ko'pik",
              'Maxsus aerozol yoki azot tizimi',
              "CO₂ o'chirgich"
            ],
            a: 2,
            exp: "Transformer yog'i yong'ini uchun maxsus aerozol o'chirgich yoki azot tizimi talab etiladi."
          }
        ]
      }
    ]
  }
];

// ===================== STYLES =====================
const S = {
  bg: '#0B1426',
  card: '#152034',
  border: '#1E2F4A',
  text: '#E8EDF4',
  muted: '#6B7FA3',
  gold: '#FFD700',
  green: '#00C896',
  red: '#FF4757',
  blue: '#3D8EFF',
  phone: '#0B1426'
};

function Heart({ full }) {
  return (
    <span style={{ color: full ? '#FF4757' : '#2A3A5A', fontSize: 18 }}>♥</span>
  );
}

function ProgressBar({ value, color = '#FFD700', bg = '#1E2F4A' }) {
  return (
    <div
      style={{
        background: bg,
        borderRadius: 99,
        height: 8,
        overflow: 'hidden',
        flex: 1
      }}
    >
      <div
        style={{
          background: color,
          height: '100%',
          width: `${Math.min(100, value)}%`,
          borderRadius: 99,
          transition: 'width 0.4s ease'
        }}
      />
    </div>
  );
}

// ===================== SCREENS =====================

function HomeScreen({ xp, streak, lives, completed, modules, onModule }) {
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const doneCount = completed.size;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '0 0 80px' }}>
      {/* Header */}
      <div
        style={{
          padding: '20px 20px 12px',
          background: 'linear-gradient(180deg,#0F1E38 0%,transparent 100%)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16
          }}
        >
          <div>
            <div
              style={{
                color: S.muted,
                fontSize: 12,
                letterSpacing: 2,
                textTransform: 'uppercase'
              }}
            >
              Work Plus
            </div>
            <div style={{ color: S.text, fontSize: 20, fontWeight: 700 }}>
              Salom, Xodim! 👋
            </div>
          </div>
          <div
            style={{
              background: '#1A2B45',
              borderRadius: 12,
              padding: '8px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'center'
            }}
          >
            <span style={{ color: '#FF6B35', fontSize: 18 }}>🔥</span>
            <span style={{ color: S.text, fontWeight: 700, fontSize: 16 }}>
              {streak}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { icon: '⚡', label: 'XP', val: xp, color: S.gold },
            { icon: '❤️', label: 'Hayot', val: lives + '/5', color: '#FF4757' },
            {
              icon: '📖',
              label: 'Dars',
              val: `${doneCount}/${totalLessons}`,
              color: S.green
            }
          ].map(({ icon, label, val, color }) => (
            <div
              key={label}
              style={{
                flex: 1,
                background: '#152034',
                borderRadius: 12,
                padding: '10px 8px',
                textAlign: 'center',
                border: `1px solid ${S.border}`
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 2 }}>{icon}</div>
              <div style={{ color, fontWeight: 700, fontSize: 15 }}>{val}</div>
              <div style={{ color: S.muted, fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Overall progress */}
      <div style={{ padding: '0 20px 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 6
          }}
        >
          <span style={{ color: S.muted, fontSize: 12 }}>Umumiy progress</span>
          <span style={{ color: S.gold, fontSize: 12, fontWeight: 700 }}>
            {Math.round((doneCount / totalLessons) * 100)}%
          </span>
        </div>
        <ProgressBar value={(doneCount / totalLessons) * 100} />
      </div>

      {/* Module cards */}
      <div style={{ padding: '0 20px' }}>
        <div
          style={{
            color: S.muted,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 12
          }}
        >
          Modullar
        </div>
        {modules.map((mod, mi) => {
          const doneMod = mod.lessons.filter((l) => completed.has(l.id)).length;
          const pct = (doneMod / mod.lessons.length) * 100;
          return (
            <div
              key={mod.id}
              onClick={() => onModule(mi)}
              style={{
                background: S.card,
                border: `1px solid ${S.border}`,
                borderRadius: 16,
                padding: '16px',
                marginBottom: 12,
                cursor: 'pointer',
                transition: 'transform 0.15s',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '4px',
                  height: '100%',
                  background: mod.color,
                  borderRadius: '16px 0 0 16px'
                }}
              />
              <div style={{ paddingLeft: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 8
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: mod.dark,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        border: `1px solid ${mod.color}44`
                      }}
                    >
                      {mod.emoji}
                    </div>
                    <div>
                      <div
                        style={{ color: S.text, fontWeight: 700, fontSize: 15 }}
                      >
                        {mod.title}
                      </div>
                      <div style={{ color: S.muted, fontSize: 12 }}>
                        {mod.lessons.length} ta dars
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      background: `${mod.color}22`,
                      borderRadius: 8,
                      padding: '4px 8px',
                      color: mod.color,
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    {doneMod}/{mod.lessons.length}
                  </div>
                </div>
                <div style={{ color: S.muted, fontSize: 12, marginBottom: 10 }}>
                  {mod.desc}
                </div>
                <ProgressBar value={pct} color={mod.color} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModuleScreen({ mod, completed, xp, onLesson, onBack }) {
  const doneMod = mod.lessons.filter((l) => completed.has(l.id)).length;
  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80 }}>
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${mod.dark} 0%, #0B1426 100%)`,
          padding: '20px 20px 24px',
          borderBottom: `1px solid ${S.border}`
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: S.muted,
            fontSize: 14,
            cursor: 'pointer',
            padding: '0 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          ← Orqaga
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 40 }}>{mod.emoji}</div>
          <div>
            <div
              style={{
                color: mod.color,
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 2
              }}
            >
              {doneMod}/{mod.lessons.length} bajarildi
            </div>
            <div style={{ color: S.text, fontSize: 22, fontWeight: 700 }}>
              {mod.title}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <ProgressBar
            value={(doneMod / mod.lessons.length) * 100}
            color={mod.color}
          />
        </div>
      </div>

      {/* Lessons */}
      <div style={{ padding: '20px' }}>
        <div
          style={{
            color: S.muted,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 14
          }}
        >
          Darslar
        </div>
        {mod.lessons.map((les, li) => {
          const done = completed.has(les.id);
          const locked = li > 0 && !completed.has(mod.lessons[li - 1].id);
          return (
            <div
              key={les.id}
              onClick={() => !locked && onLesson(li)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                background: S.card,
                borderRadius: 14,
                padding: '14px 16px',
                marginBottom: 10,
                border: `1px solid ${done ? mod.color + '66' : S.border}`,
                cursor: locked ? 'not-allowed' : 'pointer',
                opacity: locked ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  background: done
                    ? `${mod.color}22`
                    : locked
                      ? '#1A2B45'
                      : '#152034',
                  border: `1px solid ${done ? mod.color : S.border}`
                }}
              >
                {done ? '✅' : locked ? '🔒' : les.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    color: done ? mod.color : locked ? S.muted : S.text,
                    fontWeight: 600,
                    fontSize: 14
                  }}
                >
                  {les.id}-dars: {les.title}
                </div>
                <div style={{ color: S.muted, fontSize: 12, marginTop: 2 }}>
                  +{les.xp} XP • {les.slides.length} ta slayd • {les.qs.length}{' '}
                  ta savol
                </div>
              </div>
              {!locked && !done && (
                <div style={{ color: mod.color, fontSize: 20 }}>▶</div>
              )}
              {done && (
                <div
                  style={{ color: mod.color, fontSize: 12, fontWeight: 700 }}
                >
                  ✓
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlideCard({ slide, color }) {
  return (
    <div
      style={{
        background: slide.warn ? '#2D0A0A' : S.card,
        border: `1px solid ${slide.warn ? '#FF4757' : S.border}`,
        borderRadius: 16,
        padding: '20px',
        flex: 1,
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          color: slide.warn ? '#FF6B6B' : color,
          fontWeight: 700,
          fontSize: 17,
          marginBottom: 14,
          lineHeight: 1.3
        }}
      >
        {slide.head}
      </div>
      {slide.items &&
        slide.items.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 10,
              background: slide.warn ? '#3D1010' : '#0D1A2E',
              borderRadius: 10,
              padding: '10px 12px'
            }}
          >
            <span style={{ color: S.text, fontSize: 13, lineHeight: 1.5 }}>
              {item}
            </span>
          </div>
        ))}
    </div>
  );
}

function QuizQuestion({
  q,
  color,
  onAnswer,
  answered,
  selectedIdx,
  isCorrect
}) {
  const isTF = !!q.tf;
  const opts = isTF ? ["To'g'ri ✓", "Noto'g'ri ✗"] : q.opts;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: 14,
          padding: '16px'
        }}
      >
        <div
          style={{
            color: S.muted,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 8
          }}
        >
          Savol
        </div>
        <div
          style={{
            color: S.text,
            fontSize: 15,
            lineHeight: 1.6,
            fontWeight: 500
          }}
        >
          {q.q}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {opts.map((opt, oi) => {
          const realAnswer = isTF ? (oi === 0 ? true : false) : oi;
          const isCorrectOpt = isTF ? realAnswer === q.a : oi === q.a;
          let bg = S.card,
            border = S.border,
            textColor = S.text;
          if (answered) {
            if (isCorrectOpt) {
              bg = '#0D3D2A';
              border = '#00C896';
              textColor = '#00C896';
            } else if (oi === selectedIdx || opt === selectedIdx) {
              bg = '#3D0D0D';
              border = '#FF4757';
              textColor = '#FF4757';
            }
          }
          return (
            <div
              key={oi}
              onClick={() => !answered && onAnswer(oi, isCorrectOpt)}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 12,
                padding: '13px 16px',
                cursor: answered ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'all 0.2s'
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background:
                    answered && isCorrectOpt
                      ? '#00C896'
                      : answered && (oi === selectedIdx || opt === selectedIdx)
                        ? '#FF4757'
                        : `${color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: answered ? 'white' : color,
                  flexShrink: 0
                }}
              >
                {isTF ? (oi === 0 ? 'T' : 'F') : String.fromCharCode(65 + oi)}
              </div>
              <span style={{ color: textColor, fontSize: 14, lineHeight: 1.4 }}>
                {opt}
              </span>
            </div>
          );
        })}
      </div>
      {answered && (
        <div
          style={{
            background: isCorrect ? '#0D2D1A' : '#2D0D0D',
            border: `1px solid ${isCorrect ? '#00C896' : '#FF4757'}`,
            borderRadius: 12,
            padding: '14px',
            marginTop: 4
          }}
        >
          <div
            style={{
              color: isCorrect ? '#00C896' : '#FF4757',
              fontWeight: 700,
              marginBottom: 6,
              fontSize: 14
            }}
          >
            {isCorrect ? "✅ To'g'ri!" : "❌ Noto'g'ri!"}
          </div>
          <div style={{ color: S.text, fontSize: 13, lineHeight: 1.5 }}>
            {q.exp}
          </div>
        </div>
      )}
    </div>
  );
}

function LessonScreen({ mod, lesson, onComplete, onBack, lives, onLoseLife }) {
  const [phase, setPhase] = useState('theory'); // theory | quiz
  const [slideIdx, setSlideIdx] = useState(0);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [earnedXp, setEarnedXp] = useState(0);
  const [done, setDone] = useState(false);

  const totalSteps = lesson.slides.length + lesson.qs.length;
  const currentStep =
    phase === 'theory' ? slideIdx : lesson.slides.length + qIdx;

  function nextSlide() {
    if (slideIdx < lesson.slides.length - 1) {
      setSlideIdx((s) => s + 1);
    } else {
      setPhase('quiz');
    }
  }

  function handleAnswer(idx, isCorrect) {
    setSelected(idx);
    setAnswered(true);
    setCorrect(isCorrect);
    if (isCorrect)
      setEarnedXp((p) => p + Math.round(lesson.xp / lesson.qs.length));
    else onLoseLife();
  }

  function nextQuestion() {
    setAnswered(false);
    setSelected(null);
    setCorrect(false);
    if (qIdx < lesson.qs.length - 1) {
      setQIdx((q) => q + 1);
    } else {
      setDone(true);
      onComplete(
        earnedXp + (correct ? Math.round(lesson.xp / lesson.qs.length) : 0)
      );
    }
  }

  if (done) return null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div
        style={{
          padding: '14px 16px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: S.muted,
            fontSize: 20,
            cursor: 'pointer',
            padding: 0
          }}
        >
          ✕
        </button>
        <div style={{ flex: 1 }}>
          <ProgressBar
            value={(currentStep / totalSteps) * 100}
            color={mod.color}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {[...Array(5)].map((_, i) => (
            <Heart key={i} full={i < lives} />
          ))}
        </div>
      </div>

      {/* Phase label */}
      <div style={{ padding: '0 16px 10px', display: 'flex', gap: 10 }}>
        {['Nazariya', 'Savol'].map((lbl, i) => (
          <div
            key={i}
            style={{
              padding: '4px 12px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 600,
              background:
                (i === 0 && phase === 'theory') || (i === 1 && phase === 'quiz')
                  ? `${mod.color}33`
                  : 'transparent',
              color:
                (i === 0 && phase === 'theory') || (i === 1 && phase === 'quiz')
                  ? mod.color
                  : S.muted,
              border: `1px solid ${(i === 0 && phase === 'theory') || (i === 1 && phase === 'quiz') ? mod.color : S.border}`
            }}
          >
            {lbl}{' '}
            {i === 0
              ? `${slideIdx + 1}/${lesson.slides.length}`
              : `${qIdx + 1}/${lesson.qs.length}`}
          </div>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '0 16px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          gap: 12
        }}
      >
        <div style={{ color: S.muted, fontSize: 12 }}>
          {lesson.emoji} {lesson.title}
        </div>
        {phase === 'theory' ? (
          <SlideCard slide={lesson.slides[slideIdx]} color={mod.color} />
        ) : (
          <QuizQuestion
            q={lesson.qs[qIdx]}
            color={mod.color}
            onAnswer={handleAnswer}
            answered={answered}
            selectedIdx={selected}
            isCorrect={correct}
          />
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '12px 16px 16px' }}>
        {phase === 'theory' ? (
          <button
            onClick={nextSlide}
            style={{
              width: '100%',
              background: mod.color,
              border: 'none',
              borderRadius: 14,
              padding: '16px',
              color: '#000',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
              transition: 'opacity 0.2s'
            }}
          >
            {slideIdx < lesson.slides.length - 1
              ? 'Keyingisi →'
              : "Savollarga o'tish ⚡"}
          </button>
        ) : answered ? (
          <button
            onClick={nextQuestion}
            style={{
              width: '100%',
              background: correct ? '#00C896' : '#FF4757',
              border: 'none',
              borderRadius: 14,
              padding: '16px',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer'
            }}
          >
            {qIdx < lesson.qs.length - 1
              ? 'Keyingi savol →'
              : 'Darsni yakunlash 🏁'}
          </button>
        ) : (
          <div
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
              borderRadius: 14,
              padding: '16px',
              textAlign: 'center',
              color: S.muted,
              fontSize: 14
            }}
          >
            Javobni tanlang
          </div>
        )}
      </div>
    </div>
  );
}

function CompleteScreen({
  lesson,
  mod,
  earnedXp,
  totalXp,
  completed,
  onContinue
}) {
  const stars =
    earnedXp >= lesson.xp * 0.8 ? 3 : earnedXp >= lesson.xp * 0.4 ? 2 : 1;
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center'
      }}
    >
      <div
        style={{
          fontSize: 80,
          marginBottom: 16,
          animation: 'bounce 0.5s ease'
        }}
      >
        {stars === 3 ? '🏆' : stars === 2 ? '🥈' : '🥉'}
      </div>
      <div
        style={{
          color: mod.color,
          fontSize: 28,
          fontWeight: 700,
          marginBottom: 8
        }}
      >
        Barakalla!
      </div>
      <div style={{ color: S.text, fontSize: 16, marginBottom: 4 }}>
        {lesson.title}
      </div>
      <div style={{ color: S.muted, fontSize: 13, marginBottom: 28 }}>
        darsini muvaffaqiyatli tugatdingiz
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '⭐', val: stars + '/3', lbl: 'Yulduz' },
          { icon: '⚡', val: `+${earnedXp}`, lbl: 'XP' },
          { icon: '✅', lbl: 'Bajarildi', val: completed.size + 'ta' }
        ].map(({ icon, val, lbl }) => (
          <div
            key={lbl}
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
              borderRadius: 14,
              padding: '14px 16px',
              minWidth: 80,
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
            <div style={{ color: S.gold, fontWeight: 700, fontSize: 16 }}>
              {val}
            </div>
            <div style={{ color: S.muted, fontSize: 11 }}>{lbl}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          width: '100%',
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 24,
          textAlign: 'left'
        }}
      >
        <div style={{ color: S.muted, fontSize: 12, marginBottom: 8 }}>
          Umumiy progress
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ProgressBar value={(totalXp / 1000) * 100} color={mod.color} />
          <span style={{ color: S.gold, fontWeight: 700, fontSize: 14 }}>
            {totalXp} XP
          </span>
        </div>
      </div>

      <button
        onClick={onContinue}
        style={{
          width: '100%',
          background: mod.color,
          border: 'none',
          borderRadius: 14,
          padding: '16px',
          color: '#000',
          fontWeight: 700,
          fontSize: 16,
          cursor: 'pointer'
        }}
      >
        Davom etish →
      </button>
    </div>
  );
}

function ProfileScreen({ xp, streak, lives, completed, modules }) {
  const total = modules.reduce((s, m) => s + m.lessons.length, 0);
  const pct = Math.round((completed.size / total) * 100);
  const badges = [
    {
      icon: '🛡️',
      name: 'Xavfsizlik Asosi',
      desc: '1-modulni bajaring',
      earned: modules[0]?.lessons.every((l) => completed.has(l.id))
    },
    {
      icon: '🏭',
      name: 'Podstansiya Bilimdon',
      desc: '2-modulni bajaring',
      earned: modules[1]?.lessons.every((l) => completed.has(l.id))
    },
    {
      icon: '⚡',
      name: 'Texnik Usta',
      desc: '3-modulni bajaring',
      earned: modules[2]?.lessons.every((l) => completed.has(l.id))
    },
    {
      icon: '🚑',
      name: 'Avariya Qahramoni',
      desc: '4-modulni bajaring',
      earned: modules[3]?.lessons.every((l) => completed.has(l.id))
    },
    {
      icon: '🏆',
      name: 'Work Plus Chempioni',
      desc: 'Barcha darslarni bajaring',
      earned: completed.size === total
    }
  ];
  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 80 }}>
      <div
        style={{
          padding: '24px 20px',
          textAlign: 'center',
          borderBottom: `1px solid ${S.border}`
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: '#1A91DA22',
            border: '2px solid #1A91DA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            margin: '0 auto 12px'
          }}
        >
          👷
        </div>
        <div style={{ color: S.text, fontSize: 20, fontWeight: 700 }}>
          Xodim
        </div>
        <div style={{ color: S.muted, fontSize: 13 }}>
          Work Plus foydalanuvchisi
        </div>
      </div>
      <div
        style={{
          padding: '16px 20px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10
        }}
      >
        {[
          { icon: '⚡', val: xp, lbl: 'XP' },
          { icon: '🔥', val: streak, lbl: 'Kun ketma-ket' },
          { icon: '📖', val: `${completed.size}/${total}`, lbl: 'Dars' }
        ].map(({ icon, val, lbl }) => (
          <div
            key={lbl}
            style={{
              background: S.card,
              border: `1px solid ${S.border}`,
              borderRadius: 12,
              padding: '12px 8px',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
            <div style={{ color: S.gold, fontWeight: 700, fontSize: 15 }}>
              {val}
            </div>
            <div style={{ color: S.muted, fontSize: 11 }}>{lbl}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 20px 16px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8
          }}
        >
          <span style={{ color: S.muted, fontSize: 12 }}>Kurs taraqqiyoti</span>
          <span style={{ color: S.gold, fontSize: 12, fontWeight: 700 }}>
            {pct}%
          </span>
        </div>
        <ProgressBar value={pct} />
      </div>
      <div style={{ padding: '0 20px' }}>
        <div
          style={{
            color: S.muted,
            fontSize: 12,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 12
          }}
        >
          Nishonlar
        </div>
        {badges.map((b) => (
          <div
            key={b.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: S.card,
              border: `1px solid ${b.earned ? S.gold : S.border}`,
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 8,
              opacity: b.earned ? 1 : 0.5
            }}
          >
            <div style={{ fontSize: 28 }}>{b.icon}</div>
            <div>
              <div
                style={{
                  color: b.earned ? S.gold : S.muted,
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                {b.name}
              </div>
              <div style={{ color: S.muted, fontSize: 11 }}>{b.desc}</div>
            </div>
            {b.earned && (
              <div style={{ marginLeft: 'auto', color: S.gold }}>★</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================== MAIN APP =====================
export default function WorkPlus() {
  const [screen, setScreen] = useState('home');
  const [tab, setTab] = useState('home');
  const [modIdx, setModIdx] = useState(0);
  const [lesIdx, setLesIdx] = useState(0);
  const [xp, setXp] = useState(0);
  const [lives, setLives] = useState(5);
  const [streak] = useState(7);
  const [completed, setCompleted] = useState(new Set());
  const [lastEarnedXp, setLastEarnedXp] = useState(0);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&display=swap'); * { font-family: 'Exo 2', sans-serif; box-sizing: border-box; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #1E2F4A; border-radius: 4px; } @keyframes bounce { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }`;
    document.head.appendChild(style);
  }, []);

  const mod = DATA[modIdx];
  const lesson = mod.lessons[lesIdx];

  function handleLoseLife() {
    setLives((v) => Math.max(0, v - 1));
  }

  function handleLessonComplete(earned) {
    setXp((v) => v + earned);
    setLastEarnedXp(earned);
    setCompleted((prev) => {
      const n = new Set(prev);
      n.add(lesson.id);
      return n;
    });
    setScreen('complete');
  }

  function handleContinueAfterComplete() {
    setScreen('module');
  }

  const tabs = [
    { id: 'home', label: 'Bosh', icon: '🏠' },
    { id: 'modules', label: 'Darslar', icon: '📚' },
    { id: 'profile', label: 'Profil', icon: '👤' }
  ];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px 0',
        minHeight: 700
      }}
    >
      {/* Phone frame */}
      <div
        style={{
          width: 390,
          height: 780,
          background: S.bg,
          borderRadius: 44,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 0 12px #0D1825, 0 40px 80px rgba(0,0,0,0.8)'
        }}
      >
        {/* Status bar */}
        <div
          style={{
            padding: '12px 24px 4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <span style={{ color: S.muted, fontSize: 11, fontWeight: 600 }}>
            09:41
          </span>
          <div
            style={{
              width: 90,
              height: 4,
              background: '#1E2F4A',
              borderRadius: 99
            }}
          />
          <span style={{ color: S.muted, fontSize: 11 }}>⚡ 85%</span>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {screen === 'home' && tab === 'home' && (
            <HomeScreen
              xp={xp}
              streak={streak}
              lives={lives}
              completed={completed}
              modules={DATA}
              onModule={(mi) => {
                setModIdx(mi);
                setTab('modules');
                setScreen('module');
              }}
            />
          )}
          {(screen === 'module' ||
            (screen === 'home' && tab === 'modules')) && (
            <ModuleScreen
              mod={mod}
              completed={completed}
              xp={xp}
              onLesson={(li) => {
                setLesIdx(li);
                setScreen('lesson');
              }}
              onBack={() => {
                setScreen('home');
                setTab('home');
              }}
            />
          )}
          {screen === 'lesson' && (
            <LessonScreen
              mod={mod}
              lesson={lesson}
              lives={lives}
              onComplete={handleLessonComplete}
              onLoseLife={handleLoseLife}
              onBack={() => setScreen('module')}
            />
          )}
          {screen === 'complete' && (
            <CompleteScreen
              lesson={lesson}
              mod={mod}
              earnedXp={lastEarnedXp}
              totalXp={xp}
              completed={completed}
              onContinue={handleContinueAfterComplete}
            />
          )}
          {tab === 'profile' &&
            screen !== 'lesson' &&
            screen !== 'complete' && (
              <ProfileScreen
                xp={xp}
                streak={streak}
                lives={lives}
                completed={completed}
                modules={DATA}
              />
            )}
        </div>

        {/* Bottom nav */}
        {screen !== 'lesson' && screen !== 'complete' && (
          <div
            style={{
              display: 'flex',
              background: '#0D1825',
              borderTop: `1px solid ${S.border}`,
              flexShrink: 0,
              paddingBottom: 8
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTab(t.id);
                  if (t.id === 'home' || t.id === 'profile') setScreen('home');
                }}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  padding: '10px 0 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: tab === t.id ? S.gold : S.muted,
                    fontWeight: tab === t.id ? 700 : 400
                  }}
                >
                  {t.label}
                </span>
                {tab === t.id && (
                  <div
                    style={{
                      width: 16,
                      height: 3,
                      background: S.gold,
                      borderRadius: 99,
                      marginTop: 1
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
