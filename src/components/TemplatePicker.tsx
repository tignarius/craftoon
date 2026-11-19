import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import { Grid2x2 } from 'lucide-react-native';
import { GRID_CELL_SIZE, GRID_LIMIT, gridSelectionAt } from '../utils/panelGrid';

interface TemplatePickerProps {
  onSelect: (columns: number, rows: number) => void;
}

const POPUP_TOP = 42;
const POPUP_PADDING = 12;
type Selection = { columns: number; rows: number } | null;

export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const selectionRef = useRef<Selection>(null);
  const startRef = useRef({ x: 0, y: 0 });
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const update = (dx: number, dy: number) => {
    // The icon keeps the original gesture. Measure movement relative to the
    // press-down point, so entering the newly displayed grid needs no new touch.
    const next = gridSelectionAt(
      startRef.current.x + dx - POPUP_PADDING,
      startRef.current.y + dy - POPUP_TOP - POPUP_PADDING,
    );
    if (next?.columns !== selectionRef.current?.columns || next?.rows !== selectionRef.current?.rows) {
      selectionRef.current = next;
      setSelection(next);
    }
    return next;
  };

  const close = () => {
    setExpanded(false);
    selectionRef.current = null;
    setSelection(null);
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      startRef.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      selectionRef.current = null;
      setSelection(null);
      setExpanded(true);
    },
    onPanResponderMove: (_, gesture) => { update(gesture.dx, gesture.dy); },
    onPanResponderRelease: (_, gesture) => {
      // Include the release position, even if the final move event was coalesced.
      const value = update(gesture.dx, gesture.dy);
      close();
      if (value) { onSelectRef.current(value.columns, value.rows); }
    },
    onPanResponderTerminate: close,
    onPanResponderTerminationRequest: () => false,
  })).current;

  const activateAccessible = () => {
    const value = selectionRef.current;
    if (value) {
      close();
      onSelectRef.current(value.columns, value.rows);
    } else {
      setExpanded(current => !current);
    }
  };

  return (
    <View collapsable={false} style={styles.control} {...responder.panHandlers}
      accessible accessibilityRole="button" accessibilityLabel="Templates"
      accessibilityHint="Hold, drag across the grid, then release to use a template."
      accessibilityState={{ expanded }}
      accessibilityValue={{ text: selection ? `${selection.columns} by ${selection.rows}` : 'No template selected' }}
      onAccessibilityTap={activateAccessible}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: 'Use template' }]}
      onAccessibilityAction={event => {
        const action = event.nativeEvent.actionName;
        if (action === 'activate') { activateAccessible(); return; }
        const count = Math.max(1, Math.min(GRID_LIMIT,
          (selectionRef.current?.columns ?? 0) + (action === 'increment' ? 1 : -1)));
        const next = { columns: count, rows: count };
        selectionRef.current = next;
        setSelection(next);
        setExpanded(true);
      }}>
      <View pointerEvents="none" style={styles.icon}>
        <Grid2x2 size={22} color={expanded ? '#0D9488' : '#1ABC9C'} />
      </View>
      {expanded && (
        // Keep this in the same native view hierarchy: a Modal would move input
        // into another window and interrupt a pen/mouse drag begun on the icon.
        <View pointerEvents="none" style={styles.popup}>
          <View style={styles.grid}>
            {Array.from({ length: GRID_LIMIT * GRID_LIMIT }, (_, index) => {
              const column = index % GRID_LIMIT;
              const row = Math.floor(index / GRID_LIMIT);
              const active = selection && column < selection.columns && row < selection.rows;
              return <View key={index} style={[styles.cell, active && styles.cellActive]} />;
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  control: { width: 44, height: 44, zIndex: 1000, overflow: 'visible' },
  icon: { width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center' },
  popup: { position: 'absolute', top: POPUP_TOP, left: 0, padding: POPUP_PADDING,
    width: GRID_CELL_SIZE * GRID_LIMIT + POPUP_PADDING * 2,
    borderRadius: 14, backgroundColor: '#FFFFFF', shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20, elevation: 10 },
  grid: { width: GRID_CELL_SIZE * GRID_LIMIT, height: GRID_CELL_SIZE * GRID_LIMIT,
    flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: GRID_CELL_SIZE - 6, height: GRID_CELL_SIZE - 6, margin: 3,
    borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 4, backgroundColor: '#F8FAFC' },
  cellActive: { backgroundColor: '#CCFBF1', borderColor: '#0D9488' },
});
