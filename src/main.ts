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
  TAbstractFile,
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

const NOTE_OFFSETS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
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
    const loadedSettings: unknown = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, isSettingsData(loadedSettings) ? loadedSettings : {});
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

    const ownerDocument = element.ownerDocument;
    const walker = ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
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

    const ownerDocument = textNode.ownerDocument;
    const fragment = ownerDocument.createDocumentFragment();
    let cursor = 0;

    for (const match of matches) {
      if (match.from > cursor) {
        fragment.appendText(original.slice(cursor, match.from));
      }

      const button = ownerDocument.createElement("span");
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
      button.addEventListener("keydown", (event: KeyboardEvent) => {
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
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sampleBuffers = new Map<keyof typeof PIANO_SAMPLE_URLS, AudioBuffer>();
  private activeElement: HTMLElement | null = null;
  private timeoutIds: number[] = [];
  private activeNodes: AudioScheduledSourceNode[] = [];
  private playbackId = 0;

  async play(progression: PlayableChord[], settings: HarmonyProgressionPlayerSettings, element: HTMLElement) {
    this.stop();
    const playbackId = this.playbackId + 1;
    this.playbackId = playbackId;

    const audioContext = this.getAudioContext();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
    if (playbackId !== this.playbackId) {
      return;
    }

    if (settings.instrument === "sampledPiano") {
      await this.preloadSamples(audioContext, progression);
      if (playbackId !== this.playbackId) {
        return;
      }
    }

    const masterGain = this.getMasterGain();
    masterGain.gain.setTargetAtTime(clamp(settings.volume, 0.05, 1), audioContext.currentTime, 0.01);
    this.activeElement = element;
    element.addClass("is-playing");

    const now = audioContext.currentTime + 0.03;
    progression.forEach((chord, index) => {
      this.playChord(audioContext, chord.notes, settings, now + index * settings.chordSeconds, playbackId);
    });

    const endMs = Math.ceil(progression.length * settings.chordSeconds * 1000 + 160);
    this.timeoutIds.push(window.setTimeout(() => this.stop(), endMs));
  }

  stop() {
    this.playbackId += 1;

    for (const timeoutId of this.timeoutIds) {
      window.clearTimeout(timeoutId);
    }
    this.timeoutIds = [];

    for (const node of this.activeNodes) {
      try {
        node.stop();
      } catch {
        // Already stopped.
      }
    }
    this.activeNodes = [];

    this.activeElement?.removeClass("is-playing");
    this.activeElement = null;
  }

  dispose() {
    this.stop();
    this.audioContext?.close();
    this.audioContext = null;
    this.masterGain = null;
    this.sampleBuffers.clear();
  }

  private getAudioContext(): AudioContext {
    if (this.audioContext) {
      return this.audioContext;
    }

    const audioContext = new AudioContext();
    this.audioContext = audioContext;
    return audioContext;
  }

  private getMasterGain(): GainNode {
    if (this.masterGain) {
      return this.masterGain;
    }

    const audioContext = this.getAudioContext();
    this.masterGain = audioContext.createGain();
    this.masterGain.connect(audioContext.destination);
    return this.masterGain;
  }

  private async preloadSamples(audioContext: AudioContext, progression: PlayableChord[]) {
    const sampleNotes = new Set<keyof typeof PIANO_SAMPLE_URLS>();
    for (const chord of progression) {
      for (const note of chord.notes) {
        const sample = nearestSample(note);
        if (sample) {
          sampleNotes.add(sample.note);
        }
      }
    }

    await Promise.all(
      Array.from(sampleNotes).map(async (sampleNote) => {
        try {
          await this.getSampleBuffer(audioContext, sampleNote);
        } catch (error) {
          console.error("Failed to decode bundled piano sample. Falling back to soft synth.", error);
        }
      })
    );
  }

  private playChord(audioContext: AudioContext, notes: string[], settings: HarmonyProgressionPlayerSettings, startTime: number, playbackId: number) {
    if (playbackId !== this.playbackId) {
      return;
    }

    for (const note of notes) {
      if (settings.instrument === "sampledPiano") {
        void this.playSample(audioContext, note, settings.chordSeconds, startTime, playbackId);
      } else {
        this.playSynth(audioContext, note, settings.instrument, settings.chordSeconds, startTime);
      }
    }
  }

  private async playSample(audioContext: AudioContext, note: string, durationSeconds: number, startTime: number, playbackId: number) {
    const sample = nearestSample(note);
    if (!sample) {
      this.playSynth(audioContext, note, "softSynth", durationSeconds, startTime);
      return;
    }

    try {
      const buffer = await this.getSampleBuffer(audioContext, sample.note);
      if (playbackId !== this.playbackId) {
        return;
      }

      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      source.playbackRate.value = 2 ** ((midiForNote(note) - midiForNote(sample.note)) / 12);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.9, startTime + 0.012);
      gain.gain.setValueAtTime(0.9, startTime + Math.max(0.012, durationSeconds * 0.78));
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds + 0.22);
      source.connect(gain);
      gain.connect(this.getMasterGain());
      source.start(startTime);
      source.stop(startTime + durationSeconds + 0.3);
      this.trackSource(source);
    } catch (error) {
      console.error("Failed to decode bundled piano sample. Falling back to soft synth.", error);
      new Notice("Could not load bundled piano sample. Falling back to soft synth.");
      this.playSynth(audioContext, note, "softSynth", durationSeconds, startTime);
    }
  }

  private async getSampleBuffer(audioContext: AudioContext, sampleNote: keyof typeof PIANO_SAMPLE_URLS): Promise<AudioBuffer> {
    const cachedBuffer = this.sampleBuffers.get(sampleNote);
    if (cachedBuffer) {
      return cachedBuffer;
    }

    const response = await fetch(PIANO_SAMPLE_URLS[sampleNote]);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    this.sampleBuffers.set(sampleNote, buffer);
    return buffer;
  }

  private playSynth(audioContext: AudioContext, note: string, instrument: Exclude<InstrumentName, "sampledPiano">, durationSeconds: number, startTime: number) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const frequency = frequencyForNote(note);
    const config = synthConfig(instrument);

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(config.filterFrequency, startTime);
    filter.Q.setValueAtTime(config.filterQ, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(config.peakGain, startTime + config.attack);
    gain.gain.exponentialRampToValueAtTime(config.sustainGain, startTime + config.attack + config.decay);
    gain.gain.setValueAtTime(config.sustainGain, startTime + Math.max(config.attack + config.decay, durationSeconds * 0.76));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds + config.release);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterGain());
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds + config.release + 0.05);
    this.trackSource(oscillator);
  }

  private trackSource(source: AudioScheduledSourceNode) {
    this.activeNodes.push(source);
    source.addEventListener("ended", () => {
      this.activeNodes = this.activeNodes.filter((node) => node !== source);
    });
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
    this.renderSettings();
  }

  private renderSettings() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Harmony Progression Player")
      .setHeading();

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
        .setDesc(this.getFolderByPath(folder) ? "Enabled" : "Folder not found")
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

    const folder = this.getFolderByPath(normalized);
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
    this.renderSettings();
  }

  private async removeEnabledFolder(folderPath: string) {
    const folders = getEnabledFolders(this.plugin.settings.enabledFolders)
      .filter((folder) => folder !== folderPath);
    this.plugin.settings.enabledFolders = serializeEnabledFolders(folders);
    await this.plugin.saveSettings();
    this.renderSettings();
  }

  private getFolderByPath(path: string): TFolder | null {
    const abstractFile = this.app.vault.getAbstractFileByPath(path);
    return abstractFile instanceof TFolder ? abstractFile : null;
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
    return getAllFolders(this.app.vault.getRoot())
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

function isSettingsData(value: unknown): value is Partial<HarmonyProgressionPlayerSettings> {
  return typeof value === "object" && value !== null;
}

function getAllFolders(root: TFolder): TFolder[] {
  const folders: TFolder[] = [];
  const visit = (file: TAbstractFile) => {
    if (!(file instanceof TFolder)) {
      return;
    }

    if (file.path) {
      folders.push(file);
    }

    for (const child of file.children) {
      visit(child);
    }
  };

  visit(root);
  return folders;
}

function nearestSample(note: string): { note: keyof typeof PIANO_SAMPLE_URLS } | null {
  const midi = midiForNote(note);
  if (!Number.isFinite(midi)) {
    return null;
  }

  return (Object.keys(PIANO_SAMPLE_URLS) as Array<keyof typeof PIANO_SAMPLE_URLS>)
    .map((sampleNote) => ({ note: sampleNote, distance: Math.abs(midiForNote(sampleNote) - midi) }))
    .sort((left, right) => left.distance - right.distance)[0] ?? null;
}

function frequencyForNote(note: string): number {
  return 440 * 2 ** ((midiForNote(note) - 69) / 12);
}

function midiForNote(note: string): number {
  const match = note.match(/^([A-G](?:#|b)?)(-?\d+)$/u);
  if (!match) {
    return 60;
  }

  const pitchClass = match[1];
  const octave = Number(match[2]);
  return (octave + 1) * 12 + (NOTE_OFFSETS[pitchClass] ?? 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function synthConfig(instrument: Exclude<InstrumentName, "sampledPiano">): {
  type: OscillatorType;
  attack: number;
  decay: number;
  release: number;
  peakGain: number;
  sustainGain: number;
  filterFrequency: number;
  filterQ: number;
} {
  if (instrument === "brightSynth") {
    return {
      type: "triangle",
      attack: 0.01,
      decay: 0.14,
      release: 0.45,
      peakGain: 0.38,
      sustainGain: 0.17,
      filterFrequency: 5200,
      filterQ: 0.4
    };
  }

  return {
    type: "sine",
    attack: 0.04,
    decay: 0.2,
    release: 0.7,
    peakGain: 0.42,
    sustainGain: 0.15,
    filterFrequency: 3200,
    filterQ: 0.2
  };
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
