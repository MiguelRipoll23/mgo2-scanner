import { ImGui, ImVec2 } from '/jsimgui/mod.js';
import { state } from '../state.js';
import { SEARCH_TYPES, WF_NoResize } from '../constants.js';
import { runSearch, searchMove } from '../utils/search.js';

export function renderSearchWindow(vpW: number, _vpH: number): void {
  if (!state.searchState.open) return;

  const winW = 284;
  const winH = 96;
  ImGui.SetNextWindowPos(new ImVec2(vpW - winW - 8, 28), 4);
  ImGui.SetNextWindowSize(new ImVec2(winW, winH), 4);
  const swOpen: [boolean] = [true];
  ImGui.Begin('Search value', swOpen, WF_NoResize);
  if (!swOpen[0]) state.searchState.open = false;

  try {
    // Row 1: search input + Find button
    ImGui.SetNextItemWidth(-50);
    const valueRef: [string] = [state.searchState.value];
    if (ImGui.InputText('##search_value', valueRef, 256)) state.searchState.value = valueRef[0];
    ImGui.SameLine(0, 4);
    if (ImGui.Button('Find##sf')) runSearch();

    // Row 2: datatype + direction + Previous / Next
    const gap = 4;
    ImGui.SetNextItemWidth(76);
    if (ImGui.BeginCombo('##search_type_combo', state.searchState.type)) {
      try {
        for (const type of SEARCH_TYPES) {
          if (ImGui.Selectable(`${type}##search_window_type_${type}`, state.searchState.type === type))
            state.searchState.type = type;
        }
      } finally {
        ImGui.EndCombo();
      }
    }
    ImGui.SameLine(0, gap);
    const SEARCH_DIRECTIONS = ['in/out', 'in', 'out'];
    const dirLabel = state.searchState.direction === 'both' ? 'in/out' : state.searchState.direction;
    ImGui.SetNextItemWidth(76);
    if (ImGui.BeginCombo('##search_direction_combo', dirLabel)) {
      try {
        for (const d of SEARCH_DIRECTIONS) {
          const val = d === 'in/out' ? 'both' : d;
          if (ImGui.Selectable(`${d}##search_window_direction_${d}`, state.searchState.direction === val))
            state.searchState.direction = val;
        }
      } finally {
        ImGui.EndCombo();
      }
    }
    ImGui.SameLine(0, gap);
    ImGui.BeginDisabled(state.searchState.results.length === 0);
    if (ImGui.Button('Previous')) searchMove(-1);
    ImGui.SameLine(0, gap);
    if (ImGui.Button('Next')) searchMove(1);
    ImGui.EndDisabled();

    // Row 3: result count
    const resultText = state.searchState.results.length === 0
      ? 'No results'
      : `${state.searchState.index + 1} / ${state.searchState.results.length}`;
    ImGui.TextDisabled(resultText);
  } finally {
    ImGui.End();
  }
}
