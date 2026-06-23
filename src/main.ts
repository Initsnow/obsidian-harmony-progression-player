import * as Tone from "tone";
import pianoA0 from "./piano-samples/A0.mp3";
import pianoA1 from "./piano-samples/A1.mp3";
import pianoA2 from "./piano-samples/A2.mp3";
import pianoA3 from "./piano-samples/A3.mp3";
import pianoA4 from "./piano-samples/A4.mp3";
import pianoA5 from "./piano-samples/A5.mp3";
import pianoA6 from "./piano-samples/A6.mp3";
import pianoA7 from "./piano-samples/A7.mp3";
import pianoC1 from "./piano-samples/C1.mp3";
import pianoC2 from "./piano-samples/C2.mp3";
import pianoC3 from "./piano-samples/C3.mp3";
import pianoC4 from "./piano-samples/C4.mp3";
import pianoC5 from "./piano-samples/C5.mp3";
import pianoC6 from "./piano-samples/C6.mp3";
import pianoC7 from "./piano-samples/C7.mp3";
import pianoC8 from "./piano-samples/C8.mp3";
import pianoDs1 from "./piano-samples/Ds1.mp3";
import pianoDs2 from "./piano-samples/Ds2.mp3";
import pianoDs3 from "./piano-samples/Ds3.mp3";
import pianoDs4 from "./piano-samples/Ds4.mp3";
import pianoDs5 from "./piano-samples/Ds5.mp3";
import pianoDs6 from "./piano-samples/Ds6.mp3";
import pianoDs7 from "./piano-samples/Ds7.mp3";
import pianoFs1 from "./piano-samples/Fs1.mp3";
import pianoFs2 from "./piano-samples/Fs2.mp3";
import pianoFs3 from "./piano-samples/Fs3.mp3";
import pianoFs4 from "./piano-samples/Fs4.mp3";
import pianoFs5 from "./piano-samples/Fs5.mp3";
import pianoFs6 from "./piano-samples/Fs6.mp3";
import pianoFs7 from "./piano-samples/Fs7.mp3";
import {
  AbstractInputSuggest,
  App,
  MarkdownPostProcessorContext,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
  TextComponent
} from "obsidian";
import {
  findProgressions,
  parseProgression,
  PitchClass,
  PITCH_CLASSES,
  PlayableChord
} from "./harmony";

interface HarmonyProgressionPlayerSettings {
  enabledFolders: string;
  keyRoot: PitchClass;
  octave: number;
  chordSeconds: number;
  volume: number;
  instrument: InstrumentName;
}

type InstrumentName = "sampledPiano" | "softSynth" | "brightSynth";

type PlaybackInstrument = {
  triggerAttackRelease(notes: string[] | string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number): PlaybackInstrument;
  releaseAll(time?: Tone.Unit.Time): PlaybackInstrument;
  dispose(): PlaybackInstrument;
  toDestination(): PlaybackInstrument;
};

const DEFAULT_SETTINGS: HarmonyProgressionPlayerSettings = {
  enabledFolders: "",
  keyRoot: "C",
  octave: 4,
  chordSeconds: 0.85,
  volume: 0.65,
  instrument: "sampledPiano"
};

const PIANO_SAMPLE_URLS = {
  A0: pianoA0,
  C1: pianoC1,
  "D#1": pianoDs1,
  "F#1": pianoFs1,
  A1: pianoA1,
  C2: pianoC2,
  "D#2": pianoDs2,
  "F#2": pianoFs2,
  A2: pianoA2,
  C3: pianoC3,
  "D#3": pianoDs3,
  "F#3": pianoFs3,
  A3: pianoA3,
  C4: pianoC4,
  "D#4": pianoDs4,
  "F#4": pianoFs4,
  A4: pianoA4,
  C5: pianoC5,
  "D#5": pianoDs5,
  "F#5": pianoFs5,
  A5: pianoA5,
  C6: pianoC6,
  "D#6": pianoDs6,
  "F#6": pianoFs6,
  A6: pianoA6,
  C7: pianoC7,
  "D#7": pianoDs7,
  "F#7": pianoFs7,
  A7: pianoA7,
  C8: pianoC8
};

export default class HarmonyProgressionPlayerPlugin extends Plugin {
  settings: HarmonyProgressionPlayerSettings;
  private player = new ProgressionPlayer();

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new HarmonyProgressionPlayerSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((element, context) => {
      this.processMarkdown(element, context);
    });

    this.addCommand({
      id: "stop-harmony-progression",
      name: "Stop harmony progression playback",
      callback: () => this.player.stop()
    });
  }

  onunload() {
    this.player.dispose();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if ((this.settings.instrument as string) === "piano") {
      this.settings.instrument = "sampledPiano";
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private processMarkdown(element: HTMLElement, context: MarkdownPostProcessorContext) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile) || !this.shouldProcessFile(file)) {
      return;
    }

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }

        const parent = node.parentElement;
        if (!parent || parent.closest("pre, script, style, textarea, input, a, button")) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text);
    }

    for (const textNode of textNodes) {
      this.decorateTextNode(textNode);
    }
  }

  private shouldProcessFile(file: TFile): boolean {
    const folders = this.settings.enabledFolders
      .split(/[,\n]/)
      .map((folder) => normalizeFolder(folder))
      .filter(Boolean);

    if (folders.length === 0) {
      return true;
    }

    return folders.some((folder) => file.path === folder || file.path.startsWith(`${folder}/`));
  }

  private decorateTextNode(textNode: Text) {
    const original = textNode.nodeValue ?? "";
    const matches = findProgressions(original, this.settings);
    if (matches.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    let cursor = 0;

    for (const match of matches) {
      if (match.from > cursor) {
        fragment.appendText(original.slice(cursor, match.from));
      }

      const button = document.createElement("span");
      button.addClass("harmony-progression-player-token");
      button.setAttr("role", "button");
      button.setAttr("tabindex", "0");
      button.setAttr("aria-label", `Play harmony progression ${match.text}`);
      button.textContent = match.text;

      const play = async () => {
        const progression = parseProgression(match.text, this.settings);
        if (progression.length < 2) {
          new Notice("No playable harmony progression found.");
          return;
        }

        await this.player.play(progression, this.settings, button);
      };

      button.addEventListener("click", () => {
        void play();
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          void play();
        }
      });

      fragment.appendChild(button);
      cursor = match.to;
    }

    if (cursor < original.length) {
      fragment.appendText(original.slice(cursor));
    }

    textNode.replaceWith(fragment);
  }
}

class ProgressionPlayer {
  private instrument: PlaybackInstrument | null = null;
  private instrumentName: InstrumentName | null = null;
  private activeElement: HTMLElement | null = null;
  private timeoutIds: number[] = [];

  async play(progression: PlayableChord[], settings: HarmonyProgressionPlayerSettings, element: HTMLElement) {
    this.stop();

    await Tone.start();
    Tone.getDestination().volume.value = Tone.gainToDb(settings.volume);

    this.instrument = await this.getInstrument(settings.instrument);
    this.activeElement = element;
    element.addClass("is-playing");

    const now = Tone.now() + 0.03;
    progression.forEach((chord, index) => {
      this.instrument?.triggerAttackRelease(chord.notes, settings.chordSeconds * 0.88, now + index * settings.chordSeconds, 0.86);
    });

    const endMs = Math.ceil(progression.length * settings.chordSeconds * 1000 + 160);
    this.timeoutIds.push(window.setTimeout(() => this.stop(), endMs));
  }

  stop() {
    for (const timeoutId of this.timeoutIds) {
      window.clearTimeout(timeoutId);
    }
    this.timeoutIds = [];

    this.instrument?.releaseAll();

    this.activeElement?.removeClass("is-playing");
    this.activeElement = null;
  }

  dispose() {
    this.stop();
    this.instrument?.dispose();
    this.instrument = null;
    this.instrumentName = null;
  }

  private async getInstrument(instrumentName: InstrumentName): Promise<PlaybackInstrument> {
    if (this.instrument && this.instrumentName === instrumentName) {
      return this.instrument;
    }

    this.instrument?.dispose();
    this.instrument = null;
    this.instrumentName = null;

    if (instrumentName === "sampledPiano") {
      try {
        const sampler = new Tone.Sampler({
          urls: PIANO_SAMPLE_URLS,
          release: 1.1
        }).toDestination() as PlaybackInstrument;
        await Tone.loaded();
        this.instrument = sampler;
        this.instrumentName = instrumentName;
        return sampler;
      } catch (error) {
        console.error("Failed to decode bundled piano samples. Falling back to soft synth.", error);
        new Notice("Could not load bundled piano samples. Falling back to soft synth.");
      }
    }

    const synth = createSynth(instrumentName === "sampledPiano" ? "softSynth" : instrumentName).toDestination() as PlaybackInstrument;
    this.instrument = synth;
    this.instrumentName = instrumentName;
    return synth;
  }
}

class HarmonyProgressionPlayerSettingTab extends PluginSettingTab {
  plugin: HarmonyProgressionPlayerPlugin;
  private folderInput: TextComponent | null = null;

  constructor(app: App, plugin: HarmonyProgressionPlayerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Harmony Progression Player" });

    new Setting(containerEl)
      .setName("Enabled folders")
      .setDesc("Select vault folders where harmony detection should run. Leave empty to enable it everywhere.")
      .addText((text) => {
        this.folderInput = text;
        text.setPlaceholder("Start typing a folder path...");
        new FolderSuggest(this.app, text.inputEl, async (folderPath) => {
          await this.addEnabledFolder(folderPath);
        });
      })
      .addButton((button) =>
        button
          .setButtonText("Add")
          .setCta()
          .onClick(async () => {
            const folderPath = this.folderInput?.getValue() ?? "";
            await this.addEnabledFolder(folderPath);
          })
      );

    this.renderEnabledFolders(containerEl);

    new Setting(containerEl)
      .setName("Key root")
      .setDesc("Scale root used when resolving degree and Roman-numeral progressions.")
      .addDropdown((dropdown) => {
        for (const noteName of PITCH_CLASSES) {
          dropdown.addOption(noteName, noteName);
        }
        dropdown.setValue(this.plugin.settings.keyRoot).onChange(async (value) => {
          this.plugin.settings.keyRoot = value as PitchClass;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Octave")
      .setDesc("Base octave for generated voicings.")
      .addSlider((slider) =>
        slider
          .setLimits(2, 6, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.octave)
          .onChange(async (value) => {
            this.plugin.settings.octave = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Chord duration")
      .setDesc("Seconds per chord.")
      .addSlider((slider) =>
        slider
          .setLimits(0.25, 2, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.chordSeconds)
          .onChange(async (value) => {
            this.plugin.settings.chordSeconds = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Instrument")
      .setDesc("Playback instrument. Sampled piano uses bundled real piano samples.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("sampledPiano", "Sampled piano")
          .addOption("softSynth", "Soft synth")
          .addOption("brightSynth", "Bright synth")
          .setValue(this.plugin.settings.instrument)
          .onChange(async (value) => {
            this.plugin.settings.instrument = value as InstrumentName;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Volume")
      .setDesc("Playback volume.")
      .addSlider((slider) =>
        slider
          .setLimits(0.05, 1, 0.01)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.volume)
          .onChange(async (value) => {
            this.plugin.settings.volume = value;
            await this.plugin.saveSettings();
          })
      );
  }

  private renderEnabledFolders(containerEl: HTMLElement) {
    const folders = getEnabledFolders(this.plugin.settings.enabledFolders);

    if (folders.length === 0) {
      new Setting(containerEl)
        .setName("Current folders")
        .setDesc("No folder selected. Detection is enabled in the whole vault.");
      return;
    }

    for (const folder of folders) {
      new Setting(containerEl)
        .setName(folder)
        .setDesc(this.app.vault.getFolderByPath(folder) ? "Enabled" : "Folder not found")
        .addButton((button) =>
          button
            .setIcon("trash")
            .setTooltip("Remove folder")
            .onClick(async () => {
              await this.removeEnabledFolder(folder);
            })
        );
    }
  }

  private async addEnabledFolder(folderPath: string) {
    const normalized = normalizeFolder(folderPath);
    if (!normalized) {
      return;
    }

    const folder = this.app.vault.getFolderByPath(normalized);
    if (!folder) {
      new Notice(`Folder not found: ${normalized}`);
      return;
    }

    const folders = getEnabledFolders(this.plugin.settings.enabledFolders);
    if (!folders.includes(folder.path)) {
      folders.push(folder.path);
      this.plugin.settings.enabledFolders = serializeEnabledFolders(folders);
      await this.plugin.saveSettings();
    }

    this.folderInput?.setValue("");
    this.display();
  }

  private async removeEnabledFolder(folderPath: string) {
    const folders = getEnabledFolders(this.plugin.settings.enabledFolders)
      .filter((folder) => folder !== folderPath);
    this.plugin.settings.enabledFolders = serializeEnabledFolders(folders);
    await this.plugin.saveSettings();
    this.display();
  }
}

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private onChoose: (folderPath: string) => void | Promise<void>;

  constructor(app: App, inputEl: HTMLInputElement, onChoose: (folderPath: string) => void | Promise<void>) {
    super(app, inputEl);
    this.onChoose = onChoose;
  }

  protected getSuggestions(query: string): TFolder[] {
    const normalizedQuery = normalizeFolder(query).toLowerCase();
    return this.app.vault
      .getAllFolders(false)
      .filter((folder) => folder.path && folder.path.toLowerCase().includes(normalizedQuery))
      .slice(0, 50);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement) {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder) {
    this.setValue(folder.path);
    void this.onChoose(folder.path);
    this.close();
  }
}

function createSynth(instrument: Exclude<InstrumentName, "sampledPiano">): Tone.PolySynth {
  if (instrument === "brightSynth") {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.45,
        release: 0.5
      }
    });
  }

  if (instrument === "softSynth") {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.04,
        decay: 0.2,
        sustain: 0.35,
        release: 0.8
      }
    });
  }

  return new Tone.PolySynth(Tone.AMSynth, {
    harmonicity: 1.4,
    envelope: {
      attack: 0.015,
      decay: 0.25,
      sustain: 0.18,
      release: 0.65
    },
    modulationEnvelope: {
      attack: 0.02,
      decay: 0.18,
      sustain: 0.12,
      release: 0.4
    }
  });
}

function normalizeFolder(folder: string): string {
  return folder.trim().replace(/^\/+|\/+$/g, "");
}

function getEnabledFolders(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\n]/)
        .map((folder) => normalizeFolder(folder))
        .filter(Boolean)
    )
  );
}

function serializeEnabledFolders(folders: string[]): string {
  return folders.map((folder) => normalizeFolder(folder)).filter(Boolean).join("\n");
}
