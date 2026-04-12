declare module '/jsimgui/mod.js' {
  export class ImVec2 {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export namespace ImGui {
    const Col: {
      Text: number;
      WindowBg: number;
      FrameBg: number;
      FrameBgHovered: number;
      FrameBgActive: number;
      TitleBg: number;
      TitleBgActive: number;
      TitleBgCollapsed: number;
      MenuBarBg: number;
      Button: number;
      ButtonHovered: number;
      ButtonActive: number;
    } | undefined;

    const Key: {
      _LeftArrow: number;
      _RightArrow: number;
      _UpArrow: number;
      _DownArrow: number;
    } | undefined;

    function Text(text: string): void;
    function TextDisabled(text: string): void;
    function TextWrapped(text: string): void;
    function Button(label: string, size?: ImVec2): boolean;
    function SmallButton(label: string): boolean;
    function Selectable(label: string, selected: boolean, flags?: number): boolean;
    function Checkbox(label: string, v: [boolean]): boolean;
    function InputText(label: string, buf: [string], maxLen: number, flags?: number): boolean;
    function InputTextMultiline(label: string, buf: [string], maxLen: number, size?: ImVec2, flags?: number): boolean;
    function BeginMenu(label: string, enabled?: boolean): boolean;
    function MenuItem(label: string, shortcut?: string, selected?: boolean, enabled?: boolean): boolean;
    function EndMenu(): void;
    function BeginMenuBar(): boolean;
    function EndMenuBar(): void;
    function Begin(title: string, p_open?: [boolean] | null, flags?: number): boolean;
    function End(): void;
    function BeginChild(str_id: string, size?: ImVec2, border?: number, flags?: number): boolean;
    function EndChild(): void;
    function BeginTable(str_id: string, column: number, flags?: number, outer_size?: ImVec2): boolean;
    function EndTable(): void;
    function TableSetupScrollFreeze(cols: number, rows: number): void;
    function TableSetupColumn(label: string, flags?: number, init_width?: number): void;
    function TableHeadersRow(): void;
    function TableNextRow(row_flags?: number, min_row_height?: number): void;
    function TableSetColumnIndex(column_n: number): boolean;
    function BeginTabBar(str_id: string): boolean;
    function EndTabBar(): void;
    function BeginTabItem(label: string): boolean;
    function EndTabItem(): void;
    function BeginCombo(label: string, preview_value: string): boolean;
    function EndCombo(): void;
    function BeginDisabled(disabled?: boolean): void;
    function EndDisabled(): void;
    function SetNextWindowPos(pos: ImVec2, cond?: number): void;
    function SetNextWindowSize(size: ImVec2, cond?: number): void;
    function SetNextItemWidth(item_width: number): void;
    function SetCursorPosX(local_x: number): void;
    function SetCursorPosY(local_y: number): void;
    function SetScrollHereY(center_y_ratio?: number): void;
    function GetCursorPosX(): number;
    function GetCursorPosY(): number;
    function GetContentRegionAvail(): ImVec2;
    function GetTextLineHeight(): number;
    function CalcTextSize(text: string): ImVec2;
    function SameLine(offset_from_start_x?: number, spacing?: number): void;
    function Spacing(): void;
    function Separator(): void;
    function Dummy(size: ImVec2): void;
    function PushStyleColor(idx: number, col: number): void;
    function PopStyleColor(count?: number): void;
    function IsKeyPressed(key: number): boolean;
    function IsAnyItemActive(): boolean;
    function SetClipboardText(text: string): void;
    function StyleColorsDark(): void;
  }

  export namespace ImGuiImplWeb {
    function Init(options: {
      canvas: HTMLCanvasElement;
      backend: string;
      loaderPath: string;
    }): Promise<void>;
    function BeginRender(): void;
    function EndRender(): void;
  }
}
