import {
  getLegacyCurriculumUnitsRedirectUrl,
  getLegacyKeyStageRedirectUrl,
  getSeoRedirectUrl,
  withDefaultBoard,
} from "./seoRedirects";

const u = (path: string) => new URL(path, "https://www.thenational.academy");

describe("getLegacyCurriculumUnitsRedirectUrl", () => {
  it("maps the legacy curriculum units page to the programme page, dropping threads", () => {
    const out = getLegacyCurriculumUnitsRedirectUrl(
      u(
        "/teachers/curriculum/music-primary/units?threads=developing-our-singing-voice",
      ),
    );
    expect(out?.toString()).toBe(
      "https://www.thenational.academy/teachers/programmes/music-primary/units",
    );
  });

  it("keeps every other parameter and drops learning-theme", () => {
    const out = getLegacyCurriculumUnitsRedirectUrl(
      u(
        "/teachers/curriculum/maths-primary/units?years=4&learning-theme=algebra&utm_source=x",
      ),
    );
    expect(out?.toString()).toBe(
      "https://www.thenational.academy/teachers/programmes/maths-primary/units?years=4&utm_source=x",
    );
  });

  it("resolves the default board so the hop is final", () => {
    expect(
      getLegacyCurriculumUnitsRedirectUrl(
        u("/teachers/curriculum/english-secondary/units"),
      )?.toString(),
    ).toBe(
      "https://www.thenational.academy/teachers/programmes/english-secondary-aqa/units",
    );
    expect(
      getLegacyCurriculumUnitsRedirectUrl(
        u("/teachers/curriculum/science-secondary-edexcel/units"),
      )?.pathname,
    ).toBe("/teachers/programmes/science-secondary-edexcel/units");
    expect(
      getLegacyCurriculumUnitsRedirectUrl(
        u("/teachers/curriculum/citizenship-secondary/units"),
      )?.pathname,
    ).toBe("/teachers/programmes/citizenship-secondary/units");
  });

  it("does not emit a trailing ? when nothing is left", () => {
    expect(
      getLegacyCurriculumUnitsRedirectUrl(
        u("/teachers/curriculum/english-secondary-aqa/units?threads=T"),
      )?.search,
    ).toBe("");
  });

  it("returns null for other paths, including direct thread URLs", () => {
    expect(
      getLegacyCurriculumUnitsRedirectUrl(
        u("/teachers/curriculum/maths-primary/units/place-value"),
      ),
    ).toBeNull();
    expect(
      getLegacyCurriculumUnitsRedirectUrl(
        u(
          "/teachers/programmes/maths-primary/units?keystages=ks2&threads=algebra",
        ),
      ),
    ).toBeNull();
  });
});

describe("withDefaultBoard", () => {
  it("only suffixes board-less secondary slugs with a known preference", () => {
    expect(withDefaultBoard("english-secondary")).toBe("english-secondary-aqa");
    expect(withDefaultBoard("english-secondary-edexcel")).toBe(
      "english-secondary-edexcel",
    );
    expect(withDefaultBoard("maths-secondary")).toBe("maths-secondary");
    expect(withDefaultBoard("maths-primary")).toBe("maths-primary");
  });
});

describe("getLegacyKeyStageRedirectUrl", () => {
  it("maps a primary key-stage subject listing to the programme page", () => {
    expect(
      getLegacyKeyStageRedirectUrl(
        u("/teachers/key-stages/ks2/subjects/maths/programmes"),
      )?.toString(),
    ).toBe(
      "https://www.thenational.academy/teachers/programmes/maths-primary/units?keystages=ks2",
    );
  });

  it("resolves the default board for secondary subjects", () => {
    expect(
      getLegacyKeyStageRedirectUrl(
        u("/teachers/key-stages/ks3/subjects/english/programmes"),
      )?.toString(),
    ).toBe(
      "https://www.thenational.academy/teachers/programmes/english-secondary-aqa/units?keystages=ks3",
    );
  });

  it("leaves subjects with no board preference unsuffixed", () => {
    expect(
      getLegacyKeyStageRedirectUrl(
        u("/teachers/key-stages/ks4/subjects/maths/programmes"),
      )?.toString(),
    ).toBe(
      "https://www.thenational.academy/teachers/programmes/maths-secondary/units?keystages=ks4",
    );
  });

  it("maps science child subjects onto the science programme", () => {
    expect(
      getLegacyKeyStageRedirectUrl(
        u("/teachers/key-stages/ks4/subjects/biology/programmes"),
      )?.toString(),
    ).toBe(
      "https://www.thenational.academy/teachers/programmes/science-secondary-aqa/units?keystages=ks4&child_subjects=biology",
    );
  });

  it("sends the bare subjects listing to the homepage in one hop", () => {
    expect(
      getLegacyKeyStageRedirectUrl(u("/teachers/key-stages/ks2/subjects"))
        ?.pathname,
    ).toBe("/");
  });

  it("ignores unrelated paths", () => {
    expect(getLegacyKeyStageRedirectUrl(u("/teachers/key-stages"))).toBeNull();
    expect(
      getLegacyKeyStageRedirectUrl(
        u("/teachers/programmes/maths-primary/units"),
      ),
    ).toBeNull();
  });
});

describe("getSeoRedirectUrl", () => {
  it("returns null for programme requests, thread URLs included", () => {
    expect(
      getSeoRedirectUrl(u("/teachers/programmes/maths-primary/units?years=4")),
    ).toBeNull();
    expect(
      getSeoRedirectUrl(
        u(
          "/teachers/programmes/maths-primary/units?keystages=ks2&threads=algebra",
        ),
      ),
    ).toBeNull();
  });

  it("handles both legacy families", () => {
    expect(
      getSeoRedirectUrl(u("/teachers/curriculum/maths-primary/units?threads=x"))
        ?.pathname,
    ).toBe("/teachers/programmes/maths-primary/units");
    expect(
      getSeoRedirectUrl(u("/teachers/key-stages/ks2/subjects/maths/programmes"))
        ?.pathname,
    ).toBe("/teachers/programmes/maths-primary/units");
  });
});
