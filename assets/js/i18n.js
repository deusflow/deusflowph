// Clean address bar: automatically strip /index.html from URL
(function cleanUrlPath() {
  try {
    if (window.location.pathname.endsWith("/index.html")) {
      const cleanPath = window.location.pathname.replace(/\/index\.html$/, "/") + window.location.search + window.location.hash;
      window.history.replaceState(null, "", cleanPath);
    } else if (window.location.pathname.endsWith("index.html")) {
      const cleanPath = window.location.pathname.replace(/index\.html$/, "") + window.location.search + window.location.hash;
      window.history.replaceState(null, "", cleanPath);
    }
  } catch (_e) {}
})();

const UADict = {
  // Навігація
  "Weddings": "Весілля",
  "Pricing": "Ціни",
  "Portfolio": "Портфоліо",
  "About": "Про мене",
  "About Me": "Про мене",
  "Contact": "Контакти",
  "Back to Weddings": "Назад до весіль",
  "Wedding Photographer | Aarhus, Denmark": "Весільний фотограф | Орхус, Данія",
  "View All Weddings →": "Всі весілля →",
  "Explore Stories": "Дивитися серії",
  "View Portfolio": "Дивитися портфоліо",
  "Check Availability": "Перевірити дату",
  "Meet Oleh Ro": "Про Олега",
  "Meet Oleh & Philosophy": "Познайомитись з Олегом і моїм баченням",
  "Read full story": "Познайомитись з Олегом і моїм баченням",

  // Головний екран
  "Not loud.": "Тихо створюю те,",
  "But your photos will be.": "що відчувається гучно.",
  "Quietly capturing honest emotion, effortless elegance, and the timeless feeling of your day.": "Тихо фіксую справжні емоції, легку елегантність та той самий timeless вайб вашого дня.",
  "Internationally Recognized": "Міжнародні нагороди",
  "Visual Stories": "Візуальні історії",
  "Featured Weddings": "Вибрані весілля",
  "Selected Work": "Вибрані роботи",
  "Kind Words": "Відгуки",
  "Testimonials": "Відгуки",
  "Behind the Lens": "За кадром",

  // Весілля в Данії (Destination & Elopements)
  "Marrying in Denmark?": "Одружуєтесь у Данії?",
  "Denmark & Beyond": "Данія та вся Європа",
  "Whether you are planning an intimate civil elopement at Copenhagen City Hall, a romantic seaside escape on Ærø Island, or a castle celebration in Jutland — I provide a calm, discreet documentary presence and timeless editorial photography.": "Камерна церемонія в ратуші Копенгагена, романтична втеча на острів Ере чи свято в замку десь у Ютландії. Хай би що ви обрали, я поруч: спокійно, непомітно, з чесною документальною зйомкою та стильними editorial кадрами.",
  "Copenhagen": "Копенгаген",
  "Ærø Island": "Острів Ере",
  "Aarhus": "Орхус",
  "Odense": "Оденсе",
  "Aalborg": "Ольборг",
  "All Denmark & Europe": "Уся Данія та Європа",

  // За кадром (Meet Oleh)
  "I believe the most meaningful photos happen when you forget the camera is there. I stay quiet, watch the unposed moments unfold, and step in with gentle direction only when it makes you feel effortlessly beautiful.": "«Найщиріші кадри народжуються тоді, коли ви забуваєте про камеру. Я спостерігаю, ловлю живі моменти без пози і додаю легку підказку лише тоді, коли це допомагає відчути себе природно красиво».",

  // Відгуки (Testimonials)
  "Oleksandr Popov (Actor)": "Олександр Попов (Актор)",
  "Amalie & Frederik (Aarhus, Denmark)": "Амалі Франк",
  "Amalie Frank": "Амалі Франк",
  "Volodymyr Ostapchuk (TV Presenter)": "Володимир Остапчук (Телеведучий)",
  "Jerry Heil (Singer & Songwriter)": "Jerry Heil (Співачка та авторка пісень)",
  "Man, these shots look straight out of a movie. You have an incredible eye for cinematic detail. Working with you on set was effortless. Top-tier level.": "«Чувак, ці кадри виглядають прямо як стоп-кадри з кіно. У тебе шалене відчуття кінематографічних деталей. Працювати на майданчику максимально легко. Топ-рівень».",
  "Oleh has an incredible talent for capturing genuine emotions. Our wedding photos tell the perfect story of our day. Highly recommended!": "«Щойно передивились галерею, і в нас просто нема слів. Ти вловив точний вайб нашого дня. Жодних застиглих поз, тільки справжні ми. Дякуємо за цей спогад!»",
  "We just went through the gallery and we have no words. You captured the exact vibe of our day. No stiff poses, just the real us. Thank you for this memory!": "«Щойно передивились галерею, і в нас просто нема слів. Ти вловив точний вайб нашого дня. Жодних застиглих поз, тільки справжні ми. Дякуємо за цей спогад!»",
  "Wow, hvor ser det godt ud! Tusind tusind tak for det — kæmpe anbefaling! Der har virkelig været stor ros for alle billederne fra alle gæster og slottet også. Det har været fantastisk at have arbejdet med dig.": "«Вау, як же круто вийшло! Величезне дякую, це стовідсоткова рекомендація! Усі гості й навіть команда замку були в захваті від фотографій. Працювати з тобою було суцільним задоволенням».",
  "Wow, hvor ser det godt ud! Tusind tusind tak for det - kaempe anbefaling! Der har virkelig vaeret stor ros for alle billederne fra alle gaester og slottet ogsaa. Det har vaeret fantastisk at have arbejdet med jer.": "«Вау, як же круто вийшло! Величезне дякую, це стовідсоткова рекомендація! Усі гості й навіть команда замку були в захваті від фотографій. Працювати з тобою було суцільним задоволенням».",
  "We had a cozy photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic.": "«У нас була затишна зимова фотосесія, і Олег зробив увесь процес легким та комфортним. А фінальні фото — це чиста магія».",
  "We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic.": "«У нас була затишна зимова фотосесія, і Олег зробив увесь процес легким та комфортним. А фінальні фото — це чиста магія».",

  // Про мене (About Page - Paragraph by Paragraph)
  "Documentary & Editorial": "Documentary & Editorial фотографія",
  "Moments & Behind the Scenes": "Миті та за кадром",
  "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me... and I fell so deeply in love with the process that I have been doing this for over 11 years now.": "Хтось написав би тут довгий текст про велику любов суто до весільної фотографії, але моя справжня пристрасть — це мистецтво взагалі. Просто так вийшло, що весілля обрали мене самі... а я тільки за і настільки кайфонув від цього, що ось уже 11 років у справі.",
  "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me.": "Хтось написав би тут довгий текст про велику любов суто до весільної фотографії, але моя справжня пристрасть — це мистецтво взагалі. Просто так вийшло, що весілля обрали мене самі... а я тільки за і настільки кайфонув від цього, що ось уже 11 років у справі.",
  "Honestly, people started noticing things in my photos that I did not even see myself — raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in tense, stiff poses. You want to see the real, breathing story of your day. And I handle that with ease... or at least that is what my couples tell me.": "Чесно кажучи, люди почали помічати в моїх роботах те, чого не бачив навіть я сам: щирість без прикрас і моменти, які більше ніколи не повторяться. Це вирішує головну проблему пар: вам не потрібні 10 перефотошоплених світлин у напружених позах. Вам потрібна жива історія вашого дня. І з цим я справляюсь на відмінно... принаймні так кажуть мої молодята.",
  "Honestly, people started noticing things in my photos that I did not even see myself - raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in perfect poses. You want to see the real story of your day in these photos. And I handle that perfectly... or so they tell me.": "Чесно кажучи, люди почали помічати в моїх роботах те, чого не бачив навіть я сам: щирість без прикрас і моменти, які більше ніколи не повторяться. Це вирішує головну проблему пар: вам не потрібні 10 перефотошоплених світлин у напружених позах. Вам потрібна жива історія вашого дня. І з цим я справляюсь на відмінно... принаймні так кажуть мої молодята.",
  "Some say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just us.": "Кажуть, весілля — це стрес. А я приймав пологи у власної дружини в екстрених умовах. Без лікарні, тільки ми двоє.",
  "Some say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just the two of us.": "Кажуть, весілля — це стрес. А я приймав пологи у власної дружини в екстрених умовах. Без лікарні, тільки ми двоє.",
  "Your wedding day? Trust me, I've got this.": "Тож ваш весільний день? Довіртесь, усе під повним контролем.",
  "Your wedding day? Trust me, everything is completely under control.": "Тож ваш весільний день? Довіртесь, усе під повним контролем.",
  "\"I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.\"": "«Ціную справжній нерв більше за штучну ідеальність, преміальну естетику без зайвого візуального шуму і спокійний процес, у якому ви просто проживаєте свій день.»",
  "\"Real over perfect - love as it feels.\"": "«Справжнє важливіше за ідеальне — любов такою, якою вона відчувається.»",
  "\"Real over perfect — love as it feels.\"": "«Справжнє важливіше за ідеальне — любов такою, якою вона відчувається.»",
  "Values": "Цінності",
  "Background": "Бекграунд",
  "Experience": "Досвід",
  "Years of experience across Denmark and Europe.": "Років досвіду зйомок у Данії та по всій Європі.",
  "I work quietly, observe honestly, and guide only when it truly helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.": "Працюю тихо, спостерігаю чесно, підказую лише тоді, коли це дійсно потрібно. Ціную справжній нерв більше за штучну ідеальність, преміальну естетику без зайвого візуального шуму і спокійний процес, у якому ви просто проживаєте свій день.",
  "I work quietly, observe honestly, and guide only when it helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.": "Працюю тихо, спостерігаю чесно, підказую лише тоді, коли це дійсно потрібно. Ціную справжній нерв більше за штучну ідеальність, преміальну естетику без зайвого візуального шуму і спокійний процес, у якому ви просто проживаєте свій день.",
  "Originally from Ukraine, now based near Aarhus. I work across all of Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.": "Родом з України, зараз базуюся біля Орхуса. Працюю по всій Данії та Європі. Мій візуальний почерк поєднує документальну правду з editorial кадрами, тому галерея відчувається живою, елегантною і глибоко особистою.",
  "Originally from Ukraine, now based near Aarhus. I work across Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.": "Родом з України, зараз базуюся біля Орхуса. Працюю по всій Данії та Європі. Мій візуальний почерк поєднує документальну правду з editorial кадрами, тому галерея відчувається живою, елегантною і глибоко особистою.",
  "Originally from Ukraine, now based near Aarhus. I bring 10 years of wedding photography experience across Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.": "Родом з України, зараз базуюся біля Орхуса. Працюю по всій Данії та Європі. Мій візуальний почерк поєднує документальну правду з editorial кадрами, тому галерея відчувається живою, елегантною і глибоко особистою.",

  // Нагороди
  "★ Photos of the Week": "★ Фото тижня",
  "★ Unposed Moms Moments": "★ Unposed Moms Moments",
  "★ Happy Mother's Day 2022": "★ Щасливого Дня матері 2022",

  // Прямий контакт
  "Direct Inquiry": "Прямий контакт",
  "Check Availability for Your Date": "Поговоримо про ваш день",
  "Ready to Secure Your Date?": "Поговоримо про ваш день",
  "Want Your Own Story?": "Поговоримо про ваш день",
  "Love What You See?": "Поговоримо про ваш день",
  "Let's Talk About Your Day": "Поговоримо про ваш день",
  "Ready to Capture Your Story?": "Поговоримо про ваш день",
  "I take a limited number of weddings each year to ensure full dedication. Choose your preferred messenger below to check your date directly with me:": "Я за живе людське спілкування без зайвої бюрократії. Обирайте зручний месенджер, щоб обговорити ідеї, перевірити вільну дату або просто привітатися:",
  "I take a limited number of weddings each year. Choose your preferred messenger below to check availability for your date:": "Я за живе людське спілкування без зайвої бюрократії. Обирайте зручний месенджер, щоб обговорити ідеї, перевірити вільну дату або просто привітатися:",
  "Every wedding is unique. Choose your preferred messenger below to discuss your vision and check availability for your date:": "Я за живе людське спілкування без зайвої бюрократії. Обирайте зручний месенджер, щоб обговорити ідеї, перевірити вільну дату або просто привітатися:",
  "I prefer direct, personal connection. Choose your preferred messenger below to discuss your vision, check availability, or say hello:": "Я за живе людське спілкування без зайвої бюрократії. Обирайте зручний месенджер, щоб обговорити ідеї, перевірити вільну дату або просто привітатися:",
  "Fastest for Europe & International couples": "Найшвидше для Європи та міжнародних пар",
  "Прямий чат / Українська та English": "Прямий чат українською та англійською",
  "Portfolio, reels & live stories": "Портфоліо, reels і live stories",
  "Email Direct": "Email напряму",

  // Floating CTA & Banner
  "Check availability via Instagram": "Перевірити вільні дати через Instagram",
  "Calendar open for 2026-2027 weddings": "Бронювання весіль на сезон 2026-2027 відкрито",
  "Calendar open for 2026-2027 weddings ·": "Бронювання весіль на сезон 2026-2027 відкрито ·",
  "See all contact options": "Усі способи зв'язку",
  "Check availability": "Перевірити дату",

  // Пакети цін
  "Investment": "Інвестиція",
  "Collections.": "Пакети послуг.",
  "Now booking weddings across Denmark and Europe.": "Бронювання весіль на сезон 2026-2027 відкрито по всій Данії та Європі.",
  "Crafted for couples who want timeless elegance, honest storytelling, and a calm experience from planning to delivery.": "Створено для пар, які цінують позачасову елегантність, щиру історію та спокійний комфортний процес від знайомства до отримання галереї.",
  "Included in Every Collection": "Включено в кожен пакет",
  "What you always get.": "Що ви отримуєте завжди.",
  "Pre-wedding planning chat and timeline guidance": "Консультація перед весіллям та допомога з таймінгом дня",
  "Signature color grading and careful curation": "Авторське тонування та ретельний відбір кадрів",
  "Private online gallery in full resolution": "Приватна онлайн-галерея у повній роздільній здатності",
  "Personal-use rights for sharing and printing": "Повні права на особистий друк та публікацію",
  "Popular upgrades.": "Популярні опції.",
  "Add-ons": "Додатково",
  "How I Work": "Як я працюю",
  "A clear process, start to finish.": "Прозорий процес від знайомства до результату.",
  "Quick answers couples ask most.": "Відповіді на часті запитання.",

  // Футер
  "Wedding & Elopement photography for modern couples in Denmark and across Europe.": "Базуюся в Данії (район Орхуса), відкритий до зйомок по всій Європі.",
  "Luxury wedding photography in Aarhus, Copenhagen, and Europe.": "Базуюся в Данії (район Орхуса), відкритий до зйомок по всій Європі.",
  "Based in Denmark (Aarhus area), available across Europe.": "Базуюся в Данії (район Орхуса), відкритий до зйомок по всій Європі.",
  "Terms & Privacy": "Умови та приватність",
  "All rights reserved.": "Усі права захищено."
};

const DADict = {
  // Navigation
  "Weddings": "Bryllupper",
  "Pricing": "Priser",
  "Portfolio": "Portfolio",
  "About": "Om mig",
  "About Me": "Om mig",
  "Contact": "Kontakt",
  "Back to Weddings": "Tilbage til bryllupper",
  "Wedding Photographer | Aarhus, Denmark": "Bryllupsfotograf | Aarhus, Danmark",
  "View All Weddings →": "Se alle bryllupper →",
  "Explore Stories": "Udforsk historier",
  "View Portfolio": "Se portfolio",
  "Check Availability": "Tjek ledighed",
  "Meet Oleh Ro": "Mød Oleh Ro",
  "Meet Oleh & Philosophy": "Mød Oleh & Filosofi",
  "Read full story": "Læs hele historien",

  // Index Hero & Badges
  "Not loud.": "Jeg skaber stille det,",
  "But your photos will be.": "der føles stort.",
  "Quietly capturing honest emotion, effortless elegance, and the timeless feeling of your day.": "Fanger stille de ægte følelser, ubesværet elegance og den tidløse stemning af jeres dag.",
  "Internationally Recognized": "Internationalt anerkendt",
  "Visual Stories": "Visuelle historier",
  "Featured Weddings": "Udvalgte bryllupper",
  "Selected Work": "Udvalgt arbejde",
  "Kind Words": "Kundeanbefalinger",
  "Testimonials": "Anbefalinger",
  "Behind the Lens": "Bag kameraet",
  "Moments & Behind the Scenes": "Øjeblikke & bag kulisserne",

  // Elopements
  "Marrying in Denmark?": "Skal I giftes i Danmark?",
  "Denmark & Beyond": "Danmark & Europa",
  "All Denmark & Europe": "Hele Danmark & Europa",

  // Contact
  "Direct Inquiry": "Direkte henvendelse",
  "Check Availability for Your Date": "Tjek ledighed til jeres dato",
  "Ready to Secure Your Date?": "Klar til at reservere jeres dato?",
  "Want Your Own Story?": "Ønsker I jeres egen historie?",
  "Love What You See?": "Kan I lide hvad I ser?",
  "Let's Talk About Your Day": "Lad os tale om jeres dag",
  "Ready to Capture Your Story?": "Klar til at forevige jeres historie?",
  "Fastest for Europe & International couples": "Hurtigst for internationale par & Europa",
  "Email Direct": "Direkte email",

  // Pricing
  "Investment": "Investering",
  "Collections.": "Priser & Pakker.",
  "Now booking weddings across Denmark and Europe.": "Booker nu bryllupper i hele Danmark og Europa.",
  "Included in Every Collection": "Inkluderet i alle pakker",
  "What you always get.": "Hvad I altid modtager.",
  "Add-ons": "Tilvalg",
  "How I Work": "Sådan arbejder jeg",
  "A clear process, start to finish.": "En gennemskuelig proces fra start til slut.",
  "Quick answers couples ask most.": "Ofte stillede spørgsmål.",

  // Footer
  "Wedding & Elopement photography for modern couples in Denmark and across Europe.": "Bryllups- og elopementfotografi for moderne par i Danmark og Europa.",
  "Luxury wedding photography in Aarhus, Copenhagen, and Europe.": "Eksklusivt bryllupsfotografi i Aarhus, København og Europa.",
  "Based in Denmark (Aarhus area), available across Europe.": "Baseret i Danmark (Aarhus), tilgængelig i hele Europa.",
  "Terms & Privacy": "Vilkår & Privatliv"
};

const rawDefaults = {
  en: {
    hero_title_1: "Not loud.",
    hero_title_2: "But your photos will be.",
    hero_desc: "Quietly capturing honest emotion, effortless elegance, and the timeless feeling of your day.",
    hero_region: "Denmark & Beyond",
    elopement_heading: "Marrying in Denmark?",
    elopement_desc: "Whether you are planning an intimate civil elopement at Copenhagen City Hall, a romantic seaside escape on Ærø Island, or a castle celebration in Jutland — I provide a calm, discreet documentary presence and timeless editorial photography.",
    elopement_locations: "Copenhagen · Ærø Island · Aarhus · Odense · Aalborg · All Denmark & Europe",
    meet_quote: "I believe the most meaningful photos happen when you forget the camera is there. I stay quiet, watch the unposed moments unfold, and step in with gentle direction only when it makes you feel effortlessly beautiful.",
    meet_btn: "Meet Oleh & Philosophy →",
    about_header: "Documentary & Editorial",
    about_tagline: "Wedding Photographer in Denmark & Europe",
    about_story_1: "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me... and I fell so deeply in love with the process that I have been doing this for over 11 years now.",
    about_story_2: "Honestly, people started noticing things in my photos that I did not even see myself — raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in tense, stiff poses. You want to see the real, breathing story of your day. And I handle that with ease... or at least that is what my couples tell me.",
    about_story_3: "Some say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just the two of us. Your wedding day? Trust me, everything is completely under control.",
    about_quote: "I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.",
    about_values_title: "Values",
    about_values: "I work quietly, observe honestly, and guide only when it truly helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.",
    about_background_title: "Background",
    about_background: "Originally from Ukraine, now based near Aarhus. I work across all of Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.",
    about_experience_title: "Experience",
    about_experience: "Years of capturing love stories across Denmark & Europe",
    about_awards: "★ Photos of the Week · ★ Unposed Moms Moments · ★ Happy Mother's Day 2022",
    contact_heading: "Let's Talk About Your Day",
    contact_desc: "I prefer direct, personal connection. Choose your preferred messenger below to discuss your vision, check availability, or say hello:",
    whatsapp_subtitle: "Fastest for Europe & International couples",
    telegram_subtitle: "Direct Chat in Ukrainian & English",
    instagram_subtitle: "Portfolio, reels & live stories",
    email_subtitle: "Email Direct",
    footer_desc: "Based in Denmark (Aarhus area), available across Europe.",
    floating_cta_note: "Calendar open for 2026-2027 weddings · See all contact options"
  },
  ua: {
    hero_title_1: "Тихо створюю те,",
    hero_title_2: "що відчувається гучно.",
    hero_desc: "Тихо фіксую справжні емоції, легку елегантність та той самий timeless вайб вашого дня.",
    hero_region: "Данія та вся Європа",
    elopement_heading: "Одружуєтесь у Данії?",
    elopement_desc: "Камерна церемонія в ратуші Копенгагена, романтична втеча на острів Ере чи свято в замку десь у Ютландії. Хай би що ви обрали, я поруч: спокійно, непомітно, з чесною документальною зйомкою та стильними editorial кадрами.",
    elopement_locations: "Копенгаген · Острів Ере · Орхус · Оденсе · Ольборг · Уся Данія та Європа",
    meet_quote: "Найщиріші кадри народжуються тоді, коли ви забуваєте про камеру. Я спостерігаю, ловлю живі моменти без пози і додаю легку підказку лише тоді, коли це допомагає відчути себе природно красиво.",
    meet_btn: "Познайомитись з Олегом і моїм баченням →",
    about_header: "Documentary & Editorial фотографія",
    about_tagline: "Весільний фотограф у Данії та Європі",
    about_story_1: "Хтось написав би тут довгий текст про велику любов суто до весільної фотографії, але моя справжня пристрасть — це мистецтво взагалі. Просто так вийшло, що весілля обрали мене самі... а я тільки за і настільки кайфонув від цього, що ось уже 11 років у справі.",
    about_story_2: "Чесно кажучи, люди почали помічати в моїх роботах те, чого не бачив навіть я сам: щирість без прикрас і моменти, які більше ніколи не повторяться. Це вирішує головну проблему пар: вам не потрібні 10 перефотошоплених світлин у напружених позах. Вам потрібна жива історія вашого дня. І з цим я справляюсь на відмінно... принаймні так кажуть мої молодята.",
    about_story_3: "Кажуть, весілля — це стрес. А я приймав пологи у власної дружини в екстрених умовах. Без лікарні, тільки ми двоє. Тож ваш весільний день? Довіртесь, усе під повним контролем.",
    about_quote: "Ціную справжній нерв більше за штучну ідеальність, преміальну естетику без зайвого візуального шуму і спокійний процес, у якому ви просто проживаєте свій день.",
    about_values_title: "Цінності",
    about_values: "Працюю тихо, спостерігаю чесно, підказую лише тоді, коли це дійсно потрібно. Ціную справжній нерв більше за штучну ідеальність, преміальну естетику без зайвого візуального шуму і спокійний процес, у якому ви просто проживаєте свій день.",
    about_background_title: "Бекграунд",
    about_background: "Родом з України, зараз базуюся біля Орхуса. Працюю по всій Данії та Європі. Мій візуальний почерк поєднує документальну правду з editorial кадрами, тому галерея відчувається живою, елегантною і глибоко особистою.",
    about_experience_title: "Досвід",
    about_experience: "Років збереження історій кохання по всій Данії та Європі",
    about_awards: "★ Фото тижня · ★ Unposed Moms Moments · ★ Щасливого Дня матері 2022",
    contact_heading: "Поговоримо про ваш день",
    contact_desc: "Я за живе людське спілкування без зайвої бюрократії. Обирайте зручний месенджер, щоб обговорити ідеї, перевірити вільну дату або просто привітатися:",
    whatsapp_subtitle: "Найшвидше для Європи та міжнародних пар",
    telegram_subtitle: "Прямий чат українською та англійською",
    instagram_subtitle: "Портфоліо, reels і live stories",
    email_subtitle: "Email напряму",
    footer_desc: "Базуюся в Данії (район Орхуса), відкритий до зйомок по всій Європі.",
    floating_cta_note: "Бронювання весіль на сезон 2026-2027 відкрито · Усі способи зв'язку"
  },
  da: {
    hero_title_1: "Jeg skaber stille det,",
    hero_title_2: "der føles stort.",
    hero_desc: "Jeg fanger ægte følelser, afslappet elegance og stemningen fra jeres dag, som varer evigt.",
    hero_region: "Danmark og videre",
    elopement_heading: "Skal I giftes i Danmark?",
    elopement_desc: "En intim vielse på Københavns Rådhus. En rolig sommerdag ved havet på Ærø. Et bryllup på et slot et sted i Jylland. Uanset hvad I vælger, er jeg der stille, roligt og til stede, med ærlig dokumentation og billeder, der holder i mange år.",
    elopement_locations: "København · Ærø · Aarhus · Odense · Aalborg · Hele Danmark og Europa",
    meet_quote: "Jeg tror på, at de smukkeste billeder opstår, når man glemmer, at kameraet er der. Jeg holder mig i baggrunden, observerer de ægte øjeblikke, og guider kun forsigtigt, når det gør jer smukkere helt naturligt.",
    meet_btn: "Mød Oleh og hans filosofi →",
    about_header: "Dokumentar & editorial fotografi",
    about_tagline: "Bryllupsfotograf i Danmark & Europa",
    about_story_1: "Mange ville skrive her om deres store kærlighed til bryllupsfotografering. Min sande passion er kunst som helhed. Bryllupper valgte simpelthen mig.",
    about_story_2: "Helt ærligt, folk er begyndt at lægge mærke til noget i mine billeder, som jeg ikke selv så: ren ærlighed og unikke øjeblikke, der aldrig kommer igen. Det løser parrenes største problem: I skal ikke bare have ti hårdt retoucherede billeder i perfekte positurer. I skal se den ægte historie fra jeres dag. Og det klarer jeg vist ret godt... i hvert fald siger folk det.",
    about_story_3: "Nogle siger, bryllupper er stressende. Jeg forløste selv min kones barn i en nødsituation. Intet hospital. Bare os. Jeres bryllupsdag? Stol på mig, den klarer jeg.",
    about_quote: "Jeg sætter ægte følelser højere end tvungen perfektion, en gennemført æstetik uden støj, og en rolig proces, hvor I forbliver til stede i jeres dag.",
    about_values_title: "Værdier",
    about_values: "Jeg arbejder stille, observerer ærligt og guider kun, når det hjælper. Jeg sætter ægte følelser højere end tvungen perfektion, en gennemført æstetik uden støj, og en rolig proces, hvor I forbliver til stede i jeres dag.",
    about_background_title: "Baggrund",
    about_background: "Oprindeligt fra Ukraine, bor nu tæt på Aarhus. Jeg arbejder i hele Danmark og Europa. Mit visuelle sprog blander dokumentarisk sandhed med editorial billeder, så jeres galleri føles levende, elegant og dybt personligt.",
    about_experience_title: "Erfaring",
    about_experience: "År med at fange kærlighedshistorier i Danmark & Europa",
    about_awards: "★ Ugens billeder · ★ Naturlige mor-øjeblikke · ★ Glædelig mors dag 2022",
    contact_heading: "Lad os tale om jeres dag",
    contact_desc: "Jeg foretrækker direkte, personlig kontakt. Vælg den app, I er mest trygge ved, for at tale om jeres visioner, tjekke ledighed eller bare sige hej:",
    whatsapp_subtitle: "hurtigst for Europa og internationale par",
    telegram_subtitle: "hurtig chat, engelsk eller dansk",
    instagram_subtitle: "portfolio, reels og live stories",
    email_subtitle: "deuswork@icloud.com",
    footer_desc: "Baseret i Danmark (Aarhus-området), tilgængelig i hele Europa.",
    floating_cta_note: "Kalenderen er åben for bryllupper 2026-2027 · Se alle kontaktmuligheder"
  }
};

function getRawData(lang) {
  const normalizedLang = lang === "uk" ? "ua" : lang;
  const base = rawDefaults[normalizedLang] || rawDefaults.en;
  try {
    const cacheRaw = localStorage.getItem("deusflow_i18n_cache_" + normalizedLang);
    if (cacheRaw) {
      const cache = JSON.parse(cacheRaw);
      if (cache?.raw_data && typeof cache.raw_data === "object") {
        return { ...base, ...cache.raw_data };
      }
    }
    const legacyRaw = localStorage.getItem("deusflow_custom_translations_raw_" + normalizedLang);
    if (legacyRaw) {
      const customRaw = JSON.parse(legacyRaw);
      return { ...base, ...customRaw };
    }
  } catch (_e) {}
  return base;
}

function getDictionary(lang) {
  const normalizedLang = lang === "uk" ? "ua" : lang;
  let baseDict = {};
  if (normalizedLang === "ua") baseDict = { ...UADict };
  else if (normalizedLang === "da") baseDict = { ...DADict };
  else if (normalizedLang === "en") baseDict = {};

  try {
    const cacheRaw = localStorage.getItem("deusflow_i18n_cache_" + normalizedLang);
    if (cacheRaw) {
      const cache = JSON.parse(cacheRaw);
      if (cache?.dict_map && typeof cache.dict_map === "object") {
        return { ...baseDict, ...cache.dict_map };
      }
    }
    const legacyRaw = localStorage.getItem("deusflow_custom_translations_" + normalizedLang);
    if (legacyRaw) {
      const customDict = JSON.parse(legacyRaw);
      return { ...baseDict, ...customDict };
    }
  } catch (_e) {
    // Fallback to baseDict
  }

  return Object.keys(baseDict).length > 0 ? baseDict : (normalizedLang === "en" ? null : baseDict);
}

function updateMessengerLinks(lang) {
  if (lang === "uk" || lang === "ua") {
    const waLink = document.querySelector('a[href*="wa.me"]');
    if (waLink) {
      waLink.href = "https://wa.me/4550300636?text=" + encodeURIComponent("Привіт, Олеже! Ми плануємо весілля [Дата] у [Місто/Локація]. Чи вільна ця дата?");
    }
    const tgLink = document.querySelector('a[href*="t.me/OflowPhotography"]');
    if (tgLink) {
      tgLink.href = "https://t.me/OflowPhotography?text=" + encodeURIComponent("Привіт, Олеже! Ми плануємо весілля [Дата] у [Місто/Локація]. Чи вільна ця дата?");
    }
    const mailLink = document.querySelector('a[href*="mailto:deuswork@icloud.com"]');
    if (mailLink) {
      mailLink.href = "mailto:deuswork@icloud.com?subject=" + encodeURIComponent("Запит щодо весільної фотозйомки") + "&body=" + encodeURIComponent("Привіт, Олеже!\n\nМи плануємо весілля [Дата] у [Місто/Локація].\n\nПідкажи, будь ласка, чи вільна ця дата та які є пакети послуг?\n\nЗ повагою,\n[Ваші імена]");
    }
  }
}

function getActiveLanguage() {
  // 1. Explicit ?lang= query parameter (highest priority — user just clicked switcher)
  try {
    const params = new URLSearchParams(window.location.search);
    const langParam = params.get("lang");
    if (langParam) {
      const lower = langParam.toLowerCase();
      if (lower === "da" || lower === "dk") return "da";
      if (lower === "uk" || lower === "ua") return "ua";
      if (lower === "en") return "en";
    }
  } catch (_e) {}

  // 2. URL pathname: /da/... → Danish, /uk/... → Ukrainian
  try {
    const pathLang = window.location.pathname.split("/").filter(Boolean)[0];
    if (pathLang === "da") return "da";
    if (pathLang === "uk") return "ua";
  } catch (_e) {}

  // 3. <html lang="..."> attribute (set at build time by static generator)
  try {
    const htmlLang = document.documentElement.lang?.toLowerCase();
    if (htmlLang === "da") return "da";
    if (htmlLang === "uk" || htmlLang === "ua") return "ua";
  } catch (_e) {}

  // 4. localStorage (user's previous explicit choice)
  const stored = localStorage.getItem("deusflow_lang");
  if (stored === "uk") return "ua";
  return stored || "en";
}

let isTranslating = false;

function applyTranslations() {
  if (isTranslating) return;
  const currentLang = getActiveLanguage();
  const normalizedLang = currentLang === "uk" ? "ua" : currentLang;
  const dict = getDictionary(currentLang);
  const rawData = getRawData(currentLang);

  isTranslating = true;
  try {
    document.documentElement.lang = normalizedLang === "ua" ? "uk" : normalizedLang;

    // 1. Direct key-based attributes [data-i18n-key] (Always 100% reliable for dynamic CMS text)
    document.querySelectorAll("[data-i18n-key]").forEach((el) => {
      const key = el.getAttribute("data-i18n-key");
      if (rawData && rawData[key]) {
        el.textContent = rawData[key];
      }
    });

    // 2. TreeWalker for generic dictionary translation
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (n) {
          const parent = n.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.hasAttribute("data-i18n-key") || parent.closest("[data-i18n-key], .about-rich-text, [data-i18n-managed]")) {
            return NodeFilter.FILTER_REJECT;
          }
          const tag = parent.tagName.toUpperCase();
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "TEXTAREA" || tag === "CODE") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      // Store untouched source text on initial encounter
      if (typeof node._i18nOriginal !== "string") {
        node._i18nOriginal = node.nodeValue;
      }

      const original = node._i18nOriginal;
      const text = original.trim();
      if (!text) continue;

      if (!dict || normalizedLang === "en") {
        // Restore pristine English
        if (node.nodeValue !== original) {
          node.nodeValue = original;
        }
        continue;
      }

      // Direct exact match
      if (dict[text]) {
        node.nodeValue = original.replace(text, dict[text]);
        continue;
      }

      // Exact substring search match (computed strictly from original untouched text)
      let translated = original;
      let matched = false;
      for (const [enText, translatedText] of Object.entries(dict)) {
        if (enText && enText.length > 3 && original.includes(enText)) {
          translated = translated.split(enText).join(translatedText);
          matched = true;
        }
      }

      if (matched) {
        node.nodeValue = translated;
      } else if (node.nodeValue !== original) {
        node.nodeValue = original;
      }
    }

    updateMessengerLinks(normalizedLang);
  } finally {
    isTranslating = false;
  }
}

// Background Supabase Revalidation (Stale-While-Revalidate with 5-minute TTL)
async function revalidateTranslationsFromSupabase() {
  const currentLang = getActiveLanguage();
  const normalizedLang = currentLang === "uk" ? "ua" : currentLang;

  const config = window.APP_CONFIG;
  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) return;

  const cacheKey = "deusflow_i18n_cache_" + normalizedLang;
  let cached = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (_e) {}

  const now = Date.now();
  // 5-minute TTL: skip network request if cache was validated within last 5 minutes
  if (cached && cached.checked_at && (now - cached.checked_at < 5 * 60 * 1000)) {
    return;
  }

  try {
    const url = `${config.SUPABASE_URL}/rest/v1/site_translations?lang=eq.${normalizedLang}&select=dict_map,raw_data,updated_at`;
    const res = await fetch(url, {
      headers: {
        apikey: config.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${config.SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows[0]) return;

    const remote = rows[0];
    if (!cached || cached.updated_at !== remote.updated_at) {
      localStorage.setItem(cacheKey, JSON.stringify({
        dict_map: remote.dict_map || {},
        raw_data: remote.raw_data || {},
        updated_at: remote.updated_at,
        checked_at: now
      }));
      // Live apply without full page reload
      applyTranslations();
    } else {
      cached.checked_at = now;
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    }
  } catch (_err) {
    // Network failure: silently remain on local cache
  }
}

// Make globally accessible
window.applyTranslations = applyTranslations;
window.revalidateTranslationsFromSupabase = revalidateTranslationsFromSupabase;
window.getRawData = getRawData;
window.getActiveLanguage = getActiveLanguage;

function initLangSwitcher() {
  const currentLang = getActiveLanguage();
  const headerRight = document.querySelector(".site-header .header-nav-right");
  const headerInner = document.querySelector(".site-header .header-inner");
  const targetParent = headerRight || headerInner;
  if (!targetParent) return;

  if (document.querySelector(".lang-switcher")) return;

  const toggleContainer = document.createElement("div");
  toggleContainer.className = "lang-switcher";

  const languages = [
    { code: "en", label: "EN", title: "English" },
    { code: "ua", label: "UA", title: "Українська" },
    { code: "da", label: "DA", title: "Dansk" }
  ];

  languages.forEach((lang) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `lang-btn ${currentLang === lang.code ? "is-active" : ""}`;
    btn.textContent = lang.label;
    btn.title = lang.title;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (currentLang === lang.code) return;
      const targetCode = lang.code === "ua" ? "uk" : lang.code;
      localStorage.setItem("deusflow_lang", targetCode);
      try {
        const url = new URL(window.location.href);
        if (targetCode === "en") {
          url.searchParams.delete("lang");
        } else {
          url.searchParams.set("lang", targetCode);
        }
        window.location.href = url.toString();
      } catch (_err) {
        location.reload();
      }
    });

    toggleContainer.appendChild(btn);
  });

  if (headerRight) {
    headerRight.insertBefore(toggleContainer, headerRight.firstChild);
  } else {
    headerInner.appendChild(toggleContainer);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initLangSwitcher();
    applyTranslations();
    revalidateTranslationsFromSupabase();
  });
} else {
  initLangSwitcher();
  applyTranslations();
  revalidateTranslationsFromSupabase();
}
