const state = {
  data: null,
  pages: [],
  lang: "bg",
  index: 0,
  mode: "single",
  zoom: 1,
  panX: 0,
  panY: 0,
  bookWidth: 0,
  bookHeight: 0,
  flipping: false,
};

const uiText = {
  bg: {
    coverLabel: "Корица",
    pageLabel: "Страница",
    ofLabel: "от",
    allergensLabel: "Алергени",
    ingredientsLabel: "Съставки",
    emptyLabel: "Няма артикули",
    menuLabel: "Меню",
  },
  en: {
    coverLabel: "Cover",
    pageLabel: "Page",
    ofLabel: "of",
    allergensLabel: "Allergens",
    ingredientsLabel: "Ingredients",
    emptyLabel: "No items",
    menuLabel: "Menu",
  },
};

const elements = {
  book: document.getElementById("book"),
  stage: document.querySelector(".stage"),
  pageIndicator: document.getElementById("pageIndicator"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  zoomInBtn: document.getElementById("zoomInBtn"),
  zoomOutBtn: document.getElementById("zoomOutBtn"),
  zoomResetBtn: document.getElementById("zoomResetBtn"),
  langBtns: Array.from(document.querySelectorAll(".lang-btn")),
  brandTitle: document.querySelector("[data-i18n='brandTitle']"),
  brandSubtitle: document.querySelector("[data-i18n='brandSubtitle']"),
};


const getUi = () => uiText[state.lang];

const getCategoryTitle = (category) =>
  state.lang === "en" && category.title_en ? category.title_en : category.title_bg;

const isAllergensSection = (section) => {
  const title = getCategoryTitle(section).trim().toLowerCase();
  return title === "алергени" || title === "allergens";
};

const getItemName = (item) =>
  state.lang === "en" && item.name_en ? item.name_en : item.name_bg;

const getTitle = () =>
  state.lang === "en" && state.data.title_en ? state.data.title_en : state.data.title_bg;

const normalizeMenu = (data) => {
  const normalized = {
    title_bg: data.title_bg,
    title_en: data.title_en,
    currency: data.currency,
    categories: [],
  };

  const infoLines = [];
  let current = null;
  let lastItem = null;

  const isAllergensTitle = (title) => /^(алергени|allergens)\s*:/i.test(title);
  const isLowercaseStart = (title) => /^[a-zа-я]/.test(title.trim());

  const isNoteOnly = (category, title) => {
    if (category.items && category.items.length > 0) {
      return false;
    }
    if (!title) {
      return false;
    }
    const trimmed = title.trim();
    return (
      trimmed.startsWith("/") ||
      trimmed.startsWith(":") ||
      isAllergensTitle(trimmed) ||
      isLowercaseStart(trimmed)
    );
  };

  const isContactLine = (title) => {
    const trimmed = title.trim();
    const lower = trimmed.toLowerCase();
    return lower.startsWith("instagram") || lower.startsWith("телефон") || trimmed.startsWith(":");
  };

  const normalizeNote = (text) => {
    const trimmed = text.trim();
    return trimmed.replace(/^\/+/, "").replace(/\/+$/, "").trim();
  };

  const addNotes = (text) => {
    if (!lastItem) {
      return;
    }
    const note = normalizeNote(text);
    if (!note) {
      return;
    }
    if (!lastItem.notes) {
      lastItem.notes = [];
    }
    lastItem.notes.push(note);
  };

  const addItemsToCurrent = (items) => {
    if (!current) {
      current = { title_bg: "Други", title_en: "Други", items: [] };
      normalized.categories.push(current);
    }
    items.forEach((item) => {
      const newItem = {
        ...item,
        notes: item.notes ? [...item.notes] : [],
      };
      current.items.push(newItem);
      lastItem = newItem;
    });
  };

  data.categories.forEach((category) => {
    const title = category.title_bg || category.title_en || "";
    const trimmedTitle = title.trim();
    const hasItems = category.items && category.items.length > 0;

    if (!trimmedTitle && !hasItems) {
      return;
    }

    if (!hasItems && isContactLine(trimmedTitle)) {
      infoLines.push(trimmedTitle);
      return;
    }

    if (isAllergensTitle(trimmedTitle)) {
      const allergens = trimmedTitle.replace(/^(алергени|allergens)\s*:/i, "").trim();
      if (allergens && lastItem && !lastItem.allergens) {
        lastItem.allergens = allergens;
      }
      if (hasItems) {
        addItemsToCurrent(category.items);
      }
      return;
    }

    if (isNoteOnly(category, trimmedTitle)) {
      addNotes(trimmedTitle);
      return;
    }

    if (hasItems) {
      current = {
        title_bg: category.title_bg || trimmedTitle,
        title_en: category.title_en || trimmedTitle,
        items: [],
      };
      normalized.categories.push(current);
      addItemsToCurrent(category.items);
      return;
    }

    if (!current) {
      current = { title_bg: trimmedTitle, title_en: trimmedTitle, items: [] };
      normalized.categories.push(current);
      lastItem = null;
    }
  });

  if (infoLines.length) {
    normalized.categories.push({
      title_bg: "Контакти",
      title_en: "Contacts",
      items: infoLines.map((line) => ({
        name_bg: line,
        name_en: line,
        qty: "",
        price: "",
        allergens: "",
        notes: [],
      })),
    });
  }

  return normalized;
};

const getLayoutMetrics = () => {
  const compact = window.innerWidth < 900;
  const padding = compact ? 24 : 32;
  const titleBlock = compact ? 42 : 46;
  const lineHeight = compact ? 19 : 21;
  const displayMode = getDisplayMode();
  const pageWidth = state.bookWidth / (displayMode === "spread" ? 2 : 1);
  const contentHeight = state.bookHeight - padding * 2 - titleBlock;
  const baseLines = Math.floor(contentHeight / lineHeight);
  const linesPerPage = Math.max(8, Math.floor(baseLines * 0.7));
  const nameColumnWidth = Math.max(120, pageWidth - padding * 2 - 140);
  const charsPerLine = Math.max(16, Math.floor(nameColumnWidth / 7.5));
  return { linesPerPage, charsPerLine };
};

const getLayoutMetricsForSize = (width, height) => {
  const padding = 32;
  const titleBlock = 46;
  const lineHeight = 21;
  const contentHeight = height - padding * 2 - titleBlock;
  const baseLines = Math.floor(contentHeight / lineHeight);
  const linesPerPage = Math.max(8, Math.floor(baseLines * 0.7));
  const nameColumnWidth = Math.max(120, width - padding * 2 - 140);
  const charsPerLine = Math.max(16, Math.floor(nameColumnWidth / 7.5));
  return { linesPerPage, charsPerLine };
};

const estimateItemLines = (item, charsPerLine) => {
  let lines = 1.2;
  const name = getItemName(item) || "";
  const nameLines = Math.floor(name.length / charsPerLine);
  lines += nameLines * 1;
  if (item.allergens) {
    const allergenLines = Math.ceil(item.allergens.length / charsPerLine);
    lines += allergenLines * 0.9;
  }
  if (item.notes && item.notes.length) {
    const noteLength = item.notes.join(" ").length;
    const noteLines = Math.ceil(noteLength / charsPerLine);
    lines += Math.max(1, noteLines) * 1;
  }
  return lines + 0.4;
};

const buildPages = (data, metrics = getLayoutMetrics()) => {
  const { linesPerPage, charsPerLine } = metrics;
  const pages = [{ type: "cover" }];
  let currentPage = { type: "category", sections: [], usedLines: 0 };

  const pushPage = () => {
    if (currentPage.sections.length) {
      pages.push({ type: "category", sections: currentPage.sections });
    }
    currentPage = { type: "category", sections: [], usedLines: 0 };
  };

  const addSection = (category) => {
    const section = {
      title_bg: category.title_bg,
      title_en: category.title_en,
      items: [],
    };
    currentPage.sections.push(section);
    return section;
  };

  data.categories.forEach((category) => {
    const titleCost = 1.4;
    const emptyCost = 1.2;
    const items = category.items || [];

    if (currentPage.usedLines + titleCost + emptyCost > linesPerPage && currentPage.sections.length) {
      pushPage();
    }

    let section = addSection(category);
    currentPage.usedLines += titleCost;

    if (!items.length) {
      currentPage.usedLines += emptyCost;
      return;
    }

    items.forEach((item) => {
      const cost = estimateItemLines(item, charsPerLine);
      if (currentPage.usedLines + cost > linesPerPage && section.items.length) {
        pushPage();
        section = addSection(category);
        currentPage.usedLines += titleCost;
      }
      section.items.push(item);
      currentPage.usedLines += cost;
    });
  });

  pushPage();
  return pages;
};

const renderMenuPage = (pageData) => {
  const wrapper = document.createElement("div");
  pageData.sections.forEach((section) => {
    wrapper.appendChild(renderSection(section));
  });
  return wrapper;
};

const buildPageContent = (pageData) => {
  if (pageData.type === "cover") {
    return renderCover();
  }
  return renderMenuPage(pageData);
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image ${src}`));
    image.src = src;
  });

const wrapText = (ctx, text, maxWidth) => {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
    } else {
      if (line) {
        lines.push(line);
      }
      line = word;
    }
  });
  if (line) {
    lines.push(line);
  }
  return lines;
};

const renderPageToImage = async (pageData, width, height, assets) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(assets.background, 0, 0, width, height);

  const paddingX = 70;
  const paddingY = 90;
  let y = paddingY;
  const contentWidth = width - paddingX * 2;

  const fontFamily = '"Patrick Hand","Segoe Print","Segoe Script","Comic Sans MS",cursive';

  if (pageData.type === "cover") {
    ctx.fillStyle = "#2c2620";
    ctx.textAlign = "center";
    ctx.font = `72px ${fontFamily}`;
    ctx.fillText(getTitle(), width / 2, height / 2 - 300);

    const logoWidth = Math.min(600, contentWidth * 0.82);
    const logoHeight = assets.logo.height * (logoWidth / assets.logo.width);
    ctx.drawImage(
      assets.logo,
      width / 2 - logoWidth / 2,
      height / 2 - logoHeight / 2 + 10,
      logoWidth,
      logoHeight
    );

    ctx.font = `40px ${fontFamily}`;
    ctx.fillText(getUi().menuLabel, width / 2, height / 2 + 290);
    return canvas.toDataURL("image/png");
  }

  ctx.textAlign = "left";

  const titleFont = `40px ${fontFamily}`;
  const itemFont = `600 26px ${fontFamily}`;
  const qtyFont = `18px ${fontFamily}`;
  const priceFont = `700 24px ${fontFamily}`;
  const notesFont = `16px ${fontFamily}`;
  const allergensFont = `14px ${fontFamily}`;
  const contactTitleFont = `46px ${fontFamily}`;
  const contactItemFont = `600 30px ${fontFamily}`;

  const nameWidth = contentWidth - 180;
  const qtyX = width - paddingX - 100;
  const priceX = width - paddingX;

  const isContactsSection = (section) => {
    const title = getCategoryTitle(section).trim().toLowerCase();
    return title === "контакти" || title === "contacts";
  };

  pageData.sections.forEach((section, sectionIndex) => {
    if (isContactsSection(section)) {
      const lineHeight = 34;
      const lines = [];
      section.items.forEach((item) => {
        const text = getItemName(item) || "";
        if (!text.trim()) {
          return;
        }
        lines.push(...wrapText(ctx, text, contentWidth));
      });
      const titleBlock = 54;
      const blockHeight = titleBlock + lines.length * lineHeight;
      let startY = height - paddingY - blockHeight;
      if (startY < y) {
        startY = y;
      }
      ctx.fillStyle = "#2c2620";
      ctx.font = contactTitleFont;
      ctx.textAlign = "center";
      ctx.fillText(getCategoryTitle(section), width / 2, startY);
      startY += titleBlock - 8;
      ctx.font = contactItemFont;
      lines.forEach((line) => {
        ctx.fillText(line, width / 2, startY);
        startY += lineHeight;
      });
      ctx.textAlign = "left";
      return;
    }

    ctx.fillStyle = "#2c2620";
    ctx.font = titleFont;
    ctx.textAlign = "center";
    y += 4;
    ctx.fillText(getCategoryTitle(section), width / 2, y);
    y += 60;
    ctx.textAlign = "left";

    if (!section.items.length) {
      ctx.font = notesFont;
      ctx.fillStyle = "#4e3f34";
      ctx.fillText(getUi().emptyLabel, paddingX, y);
      y += 18;
      return;
    }

    if (isAllergensSection(section)) {
      const columnGap = 40;
      const columnWidth = (contentWidth - columnGap) / 2;
      const leftX = paddingX;
      const rightX = paddingX + columnWidth + columnGap;
      const lineHeight = 28;

      section.items.forEach((item) => {
        ctx.fillStyle = "#2c2620";
        ctx.font = itemFont;
        const leftLines = wrapText(ctx, getItemName(item) || "", columnWidth);
        const rightLines = wrapText(ctx, item.qty || "", columnWidth);
        const rowLines = Math.max(leftLines.length, rightLines.length);

        leftLines.forEach((line, index) => {
          ctx.fillText(line, leftX, y + index * lineHeight);
        });
        rightLines.forEach((line, index) => {
          ctx.fillText(line, rightX, y + index * lineHeight);
        });

        y += rowLines * lineHeight + 8;
      });

      if (sectionIndex < pageData.sections.length - 1) {
        y += 40;
      }
      return;
    }

    section.items.forEach((item) => {
      ctx.fillStyle = "#2c2620";
      ctx.font = itemFont;
      const nameLines = wrapText(ctx, getItemName(item) || "", nameWidth);
      nameLines.forEach((line, index) => {
        ctx.fillText(line, paddingX, y + index * 30);
      });

      ctx.fillStyle = "#4d4035";
      ctx.font = qtyFont;
      ctx.textAlign = "right";
      if (item.qty) {
        ctx.fillText(item.qty, qtyX, y);
      }

      ctx.fillStyle = "#2c2620";
      ctx.font = priceFont;
      ctx.fillText(item.price || "", priceX, y);

      ctx.textAlign = "left";
      y += nameLines.length * 30;

      if (item.notes && item.notes.length) {
        ctx.fillStyle = "#4e3f34";
        ctx.font = notesFont;
        const noteLines = wrapText(
          ctx,
          `${getUi().ingredientsLabel}: ${item.notes.join(" ")}`,
          contentWidth
        );
        noteLines.forEach((line) => {
          ctx.fillText(line, paddingX, y);
          y += 24;
        });
      }

      if (item.allergens) {
        ctx.fillStyle = "#7a3a2e";
        ctx.font = allergensFont;
        const allergenLines = wrapText(
          ctx,
          `${getUi().allergensLabel}: ${item.allergens}`,
          contentWidth
        );
        allergenLines.forEach((line) => {
          ctx.fillText(line, paddingX, y);
          y += 22;
        });
      }

      y += 10;
    });

    if (sectionIndex < pageData.sections.length - 1) {
      y += 40;
    }
  });

  return canvas.toDataURL("image/png");
};

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

const fetchDataUrl = (path) =>
  fetch(path).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${path}`);
    }
    return response.blob();
  }).then((blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${path}`));
    reader.readAsDataURL(blob);
  }));

const ensureFontsLoaded = async () => {
  const fontName = "Patrick Hand";
  const fontUrl = "fonts/patrick-hand-v25-latin-regular.woff2";
  if ("FontFace" in window) {
    const face = new FontFace(fontName, `url(${fontUrl})`, {
      style: "normal",
      weight: "400",
    });
    await face.load();
    if (document.fonts && document.fonts.add) {
      document.fonts.add(face);
      if (document.fonts.load) {
        await document.fonts.load(`16px "${fontName}"`);
      }
      await document.fonts.ready;
      return;
    }
  }
  if (document.fonts && document.fonts.load) {
    await document.fonts.load(`16px "${fontName}"`);
    await document.fonts.ready;
  }
};

const initDflip = async () => {
  const response = await fetch("data/menu.json");
  state.data = normalizeMenu(await response.json());

  await ensureFontsLoaded();

  const storedLang = localStorage.getItem("menuLang");
  if (storedLang) {
    state.lang = storedLang;
  }

  if (elements.brandTitle) {
    elements.brandTitle.textContent = getTitle();
  }
  if (elements.brandSubtitle) {
    elements.brandSubtitle.textContent = getUi().menuLabel;
  }

  const pageWidth = 1240;
  const pageHeight = 1754;
  state.pages = buildPages(state.data, getLayoutMetricsForSize(pageWidth, pageHeight));
  const assets = {
    background: await loadImage(await fetchDataUrl("background.png")),
    logo: await loadImage(await fetchDataUrl("logo.png")),
  };

  const imageSources = [];
  for (const page of state.pages) {
    imageSources.push(await renderPageToImage(page, pageWidth, pageHeight, assets));
  }

  window.option_menu_book = {
    source: imageSources,
    webgl: true,
  };

  await loadScript("dflip/js/libs/jquery.min.js");
  await loadScript("dflip/js/dflip.min.js");
};

const setLanguage = (lang) => {
  state.lang = lang;
  localStorage.setItem("menuLang", lang);
  document.documentElement.lang = lang;
  elements.langBtns.forEach((btn) =>
    btn.classList.toggle("active", btn.dataset.lang === lang)
  );
  elements.brandSubtitle.textContent = getUi().menuLabel;
  elements.brandTitle.textContent = getTitle();
  render();
};

const renderCover = () => {
  const wrapper = document.createElement("div");
  wrapper.className = "cover";

  const title = document.createElement("div");
  title.className = "cover-title";
  title.textContent = getTitle();

  const logo = document.createElement("img");
  logo.src = "logo.png";
  logo.alt = "Logo";
  logo.className = "cover-logo";

  const subtitle = document.createElement("div");
  subtitle.className = "cover-subtitle";
  subtitle.textContent = getUi().menuLabel;

  wrapper.appendChild(title);
  wrapper.appendChild(logo);
  wrapper.appendChild(subtitle);
  return wrapper;
};

const renderSection = (category) => {
  const wrapper = document.createElement("div");
  wrapper.className = "menu-section";

  const title = document.createElement("div");
  title.className = "category-title";
  title.textContent = getCategoryTitle(category);
  wrapper.appendChild(title);

  const list = document.createElement("div");
  list.className = "items";
  if (isAllergensSection(category)) {
    list.classList.add("allergens-list");
  }

  if (!category.items.length) {
    const empty = document.createElement("div");
    empty.textContent = getUi().emptyLabel;
    list.appendChild(empty);
  } else if (isAllergensSection(category)) {
    category.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "menu-item allergens-item";

      const name = document.createElement("div");
      name.className = "menu-item-name";
      name.textContent = getItemName(item);

      const qty = document.createElement("div");
      qty.className = "menu-item-qty";
      qty.textContent = item.qty;

      row.appendChild(name);
      row.appendChild(qty);

      list.appendChild(row);
    });
  } else {
    category.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "menu-item";

      const name = document.createElement("div");
      name.className = "menu-item-name";
      name.textContent = getItemName(item);

      const qty = document.createElement("div");
      qty.className = "menu-item-qty";
      qty.textContent = item.qty;

      const price = document.createElement("div");
      price.className = "menu-item-price";
      price.textContent = item.price;

      row.appendChild(name);
      if (item.qty) {
        row.appendChild(qty);
      } else {
        row.appendChild(document.createElement("div"));
      }
      row.appendChild(price);

      if (item.notes && item.notes.length) {
        const notes = document.createElement("div");
        notes.className = "menu-item-ingredients";
        notes.textContent = `${getUi().ingredientsLabel}: ${item.notes.join(" ")}`;
        row.appendChild(notes);
      }

      if (item.allergens) {
        const allergens = document.createElement("div");
        allergens.className = "menu-item-allergens";
        allergens.textContent = `${getUi().allergensLabel}: ${item.allergens}`;
        row.appendChild(allergens);
      }

      list.appendChild(row);
    });
  }

  wrapper.appendChild(list);
  return wrapper;
};

const normalizeIndex = () => {
  const maxIndex = state.pages.length - 1;
  if (state.index < 0) {
    state.index = 0;
  }
  if (state.index > maxIndex) {
    state.index = maxIndex;
  }
  if (state.mode === "spread" && state.index > 0 && state.index % 2 === 0) {
    state.index -= 1;
  }
};

const getDisplayMode = () => {
  if (state.mode === "spread" && state.index > 0) {
    return "spread";
  }
  return "single";
};

const createPageElement = (pageData, side) => {
  const page = document.createElement("div");
  page.className = `page ${side}`;
  if (side === "single") {
    page.classList.add("single");
  }

  const inner = document.createElement("div");
  inner.className = "page-inner";

  const content = document.createElement("div");
  content.className = "page-content";

  content.appendChild(buildPageContent(pageData));

  inner.appendChild(content);
  page.appendChild(inner);
  return page;
};

const updateIndicator = () => {
  const total = state.pages.length;
  const label = getUi().pageLabel;
  const ofLabel = getUi().ofLabel;
  if (state.mode === "spread" && state.index > 0) {
    const end = Math.min(state.index + 2, total);
    elements.pageIndicator.textContent = `${label} ${state.index + 1}-${end} ${ofLabel} ${total}`;
  } else {
    elements.pageIndicator.textContent = `${label} ${state.index + 1} ${ofLabel} ${total}`;
  }
};

const canGoNext = () => {
  const maxIndex = state.pages.length - 1;
  if (state.mode === "single") {
    return state.index < maxIndex;
  }
  if (state.index === 0) {
    return maxIndex >= 1;
  }
  return state.index + 2 <= maxIndex;
};

const canGoPrev = () => state.index > 0;

const updateNavButtons = () => {
  elements.prevBtn.disabled = !canGoPrev();
  elements.nextBtn.disabled = !canGoNext();
};

const render = () => {
  elements.book.innerHTML = "";
  normalizeIndex();
  setBookSize();
  state.pages = buildPages(state.data);
  normalizeIndex();
  const displayMode = getDisplayMode();
  elements.book.classList.toggle("single", displayMode === "single");

  if (displayMode === "spread") {
    const leftPage = state.pages[state.index];
    const rightPage = state.pages[state.index + 1];
    if (leftPage) {
      elements.book.appendChild(createPageElement(leftPage, "left"));
    }
    if (rightPage) {
      elements.book.appendChild(createPageElement(rightPage, "right"));
    }
  } else {
    const pageData = state.pages[state.index];
    if (pageData) {
      elements.book.appendChild(createPageElement(pageData, "single"));
    }
  }

  updateIndicator();
  updateNavButtons();
};

const applyTransform = () => {
  elements.book.style.setProperty("--zoom", state.zoom);
  elements.book.style.setProperty("--pan-x", `${state.panX}px`);
  elements.book.style.setProperty("--pan-y", `${state.panY}px`);
  elements.zoomResetBtn.textContent = `${Math.round(state.zoom * 100)}%`;
};

const clampPan = () => {
  const maxX = Math.max(0, (state.bookWidth * state.zoom - state.bookWidth) / 2);
  const maxY = Math.max(0, (state.bookHeight * state.zoom - state.bookHeight) / 2);
  state.panX = Math.min(maxX, Math.max(-maxX, state.panX));
  state.panY = Math.min(maxY, Math.max(-maxY, state.panY));
  applyTransform();
};

const setZoom = (value) => {
  state.zoom = Math.min(2.4, Math.max(1, value));
  if (state.zoom === 1) {
    state.panX = 0;
    state.panY = 0;
  }
  clampPan();
};

const updateMode = () => {
  state.mode = window.innerWidth >= 900 ? "spread" : "single";
  normalizeIndex();
};

const setBookSize = () => {
  const stage = elements.stage;
  const displayMode = getDisplayMode();
  const maxW = stage.clientWidth * (displayMode === "spread" ? 0.92 : 0.96);
  const maxH = stage.clientHeight * (displayMode === "spread" ? 0.86 : 0.9);
  const pageRatio = 853 / 1280;
  const bookRatio = displayMode === "spread" ? pageRatio * 2 : pageRatio;
  let width = maxW;
  let height = width / bookRatio;
  if (height > maxH) {
    height = maxH;
    width = height * bookRatio;
  }
  state.bookWidth = width;
  state.bookHeight = height;
  elements.book.style.setProperty("--book-width", `${width}px`);
  elements.book.style.setProperty("--book-height", `${height}px`);
  clampPan();
};

const goNextIndex = () => {
  const maxIndex = state.pages.length - 1;
  if (state.mode === "single") {
    state.index = Math.min(maxIndex, state.index + 1);
  } else if (state.index === 0) {
    state.index = 1;
  } else {
    state.index = Math.min(maxIndex, state.index + 2);
  }
  normalizeIndex();
};

const goPrevIndex = () => {
  if (state.mode === "single") {
    state.index -= 1;
  } else if (state.index === 1) {
    state.index = 0;
  } else {
    state.index -= 2;
  }
  normalizeIndex();
};

const triggerFlip = (direction) => {
  if (state.flipping) {
    return;
  }
  if (direction === "next" && !canGoNext()) {
    return;
  }
  if (direction === "prev" && !canGoPrev()) {
    return;
  }
  const page = direction === "next"
    ? elements.book.querySelector(".page.right") || elements.book.querySelector(".page")
    : elements.book.querySelector(".page.left") || elements.book.querySelector(".page");
  if (!page) {
    if (direction === "next") {
      goNextIndex();
    } else {
      goPrevIndex();
    }
    render();
    return;
  }
  state.flipping = true;
  elements.book.classList.add("flipping");
  page.classList.add(direction === "next" ? "turn-next" : "turn-prev");
  const onEnd = () => {
    elements.book.classList.remove("flipping");
    state.flipping = false;
    if (direction === "next") {
      goNextIndex();
    } else {
      goPrevIndex();
    }
    render();
  };
  page.addEventListener("transitionend", onEnd, { once: true });
};

const initInteractions = () => {
  elements.prevBtn.addEventListener("click", () => triggerFlip("prev"));
  elements.nextBtn.addEventListener("click", () => triggerFlip("next"));

  elements.zoomInBtn.addEventListener("click", () => setZoom(state.zoom + 0.2));
  elements.zoomOutBtn.addEventListener("click", () => setZoom(state.zoom - 0.2));
  elements.zoomResetBtn.addEventListener("click", () => setZoom(1));

  elements.langBtns.forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      triggerFlip("prev");
    }
    if (event.key === "ArrowRight") {
      triggerFlip("next");
    }
  });

  let lastWheelTime = 0;
  elements.stage.addEventListener(
    "wheel",
    (event) => {
      if (state.zoom > 1 || state.flipping) {
        return;
      }
      const now = Date.now();
      if (now - lastWheelTime < 450) {
        event.preventDefault();
        return;
      }
      if (Math.abs(event.deltaY) < 10) {
        return;
      }
      event.preventDefault();
      lastWheelTime = now;
      triggerFlip(event.deltaY > 0 ? "next" : "prev");
    },
    { passive: false }
  );

  let dragState = null;
  elements.stage.addEventListener("pointerdown", (event) => {
    dragState = {
      x: event.clientX,
      y: event.clientY,
      panX: state.panX,
      panY: state.panY,
      time: Date.now(),
    };
    elements.stage.setPointerCapture(event.pointerId);
  });

  elements.stage.addEventListener("pointermove", (event) => {
    if (!dragState) {
      return;
    }
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (state.zoom > 1) {
      state.panX = dragState.panX + dx;
      state.panY = dragState.panY + dy;
      clampPan();
    }
  });

  const endDrag = (event) => {
    if (!dragState) {
      return;
    }
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (state.zoom === 1) {
      if (absX > 50 && absX > absY) {
        if (dx < 0) {
          triggerFlip("next");
        } else {
          triggerFlip("prev");
        }
      } else if (absX < 10 && absY < 10) {
        const rect = elements.stage.getBoundingClientRect();
        const x = event.clientX - rect.left;
        if (x < rect.width * 0.35) {
          triggerFlip("prev");
        } else if (x > rect.width * 0.65) {
          triggerFlip("next");
        }
      }
    }
    dragState = null;
  };

  elements.stage.addEventListener("pointerup", endDrag);
  elements.stage.addEventListener("pointercancel", () => {
    dragState = null;
  });

  window.addEventListener("resize", () => {
    updateMode();
    setBookSize();
    render();
  });
};

const init = async () => {
  const response = await fetch("data/menu.json");
  state.data = normalizeMenu(await response.json());
  state.pages = buildPages(state.data);

  const storedLang = localStorage.getItem("menuLang");
  if (storedLang) {
    state.lang = storedLang;
  }

  elements.brandTitle.textContent = getTitle();
  elements.brandSubtitle.textContent = getUi().menuLabel;

  updateMode();
  setBookSize();
  setZoom(1);
  render();
  initInteractions();
  setLanguage(state.lang);
};

if (document.getElementById("menu_book")) {
  initDflip();
} else {
  init();
}
