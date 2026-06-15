import { getSupabase } from "./supabase-client.js";
import { createStateMessage, initScrollReveals } from "./ui.js";

const photoNode = document.getElementById("about-photo");
const storyNode = document.getElementById("about-story");
const valuesNode = document.getElementById("about-values");
const personalNode = document.getElementById("about-personal");
const testimonialsGrid = document.getElementById("testimonials-grid");

const fallback = {
  photo_url: "https://firnyacuwvxsolxljqxu.supabase.co/storage/v1/object/public/photos/theone_408654191.jpg",
  story:
    "Many would write here about their deep love for wedding photography, but my true passion is art as a whole. Weddings simply chose me.\n\nHonestly, people started noticing things in my photos that I did not even see myself - raw sincerity and unique, unrepeatable moments. This solves the biggest problem for couples: you do not just want 10 heavily retouched pictures in perfect poses. You want to see the real story of your day in these photos. And I handle that perfectly... or so they tell me.\n\nSome say weddings are stressful. I delivered my wife's baby in an emergency. No hospital. Just us.\n\nYour wedding day? Trust me, I've got this.",
  values_text:
    "I work quietly, observe honestly, and guide only when it helps. I value real emotion over forced perfection, premium aesthetics over noise, and a calm process that lets you stay present in your day.",
  personal_text:
    "Originally from Ukraine, now based near Aarhus. I bring 10 years of wedding photography experience across Denmark and Europe. My visual language mixes documentary truth with editorial frames, so your gallery feels alive, elegant, and deeply personal.",
  testimonials: [
    {
      name: "Volodymyr Ostapchuk (TV Presenter)",
      quote: "Oleh has an incredible talent for capturing genuine emotions. Our wedding photos tell the perfect story of our day. Highly recommended!"
    },
    {
      name: "Jerry Heil (Singer & Songwriter)",
      quote: "We had a cozy winter photoshoot, and Oleh made the whole process effortless and comfortable. The final pictures are pure magic."
    },
    {
      name: "Oleksandr Popov (Actor)",
      quote: "I worked with Oleh on a shoot for my TV series. He is an absolute professional with a great eye for cinematic detail."
    },
    {
      name: "Amalie Frank",
      quote:
        "Wow, hvor ser det godt ud! Tusind tusind tak for det - kaempe anbefaling! Der har virkelig vaeret stor ros for alle billederne fra alle gaester og slottet ogsaa. Det har vaeret fantastisk at have arbejdet med jer."
    }
  ]
};

function normalizeMultilineText(value) {
  return String(value || "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n");
}

function normalizeTestimonials(value) {
  if (!Array.isArray(value)) {
    return fallback.testimonials;
  }

  const list = value
    .map((item) => ({
      name: String(item?.name || "").trim(),
      quote: String(item?.quote || "").trim()
    }))
    .filter((item) => item.name && item.quote);

  return list.length ? list : fallback.testimonials;
}

function renderRichText(node, text) {
  if (!node) {
    return;
  }

  node.innerHTML = "";
  normalizeMultilineText(text)
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      node.appendChild(p);
    });
}

function renderTestimonials(list) {
  if (!testimonialsGrid) {
    return;
  }

  testimonialsGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  list.forEach((item) => {
    const card = document.createElement("article");
    card.className = "panel testimonial-card";

    const quote = document.createElement("p");
    quote.className = "testimonial-quote";
    quote.textContent = `"${item.quote}"`;

    const author = document.createElement("p");
    author.className = "testimonial-name";
    author.textContent = item.name;

    card.appendChild(quote);
    card.appendChild(author);
    fragment.appendChild(card);
  });

  testimonialsGrid.appendChild(fragment);
}

function renderAbout(content) {
  const about = {
    ...fallback,
    ...content,
    testimonials: normalizeTestimonials(content?.testimonials)
  };

  // Photo preloaded in HTML, do not override
  
  renderRichText(storyNode, about.story);
  renderRichText(valuesNode, about.values_text);
  renderRichText(personalNode, about.personal_text);
  renderTestimonials(about.testimonials);
}

async function loadAbout() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from("about_content").select("*").eq("id", 1).maybeSingle();
    if (error) {
      throw error;
    }
    renderAbout(data || fallback);
  } catch (error) {
    renderAbout(fallback);
    if (testimonialsGrid) {
      testimonialsGrid.prepend(createStateMessage(`Live About content unavailable. Showing fallback. ${error.message}`));
    }
  }
}

loadAbout().then(() => {
  initScrollReveals();
});

