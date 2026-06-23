'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, Lightbulb, MousePointerClick, X } from 'lucide-react';

interface HelpContent {
  title: string;
  description: string;
  instruction: string;
}

interface HelpTarget {
  element: HTMLElement;
  content: HelpContent;
  x: number;
  y: number;
}

const ACTION_GUIDES: Array<[RegExp, string, string]> = [
  [/seed|backtest/i, 'Generates historical predictions so model performance can be measured against known outcomes.', 'Choose a test size, then click to start the backtest. You can monitor its progress while it runs.'],
  [/verify/i, 'Checks predictions whose target dates have passed and compares them with the actual market result.', 'Click to update accuracy statistics using newly available market outcomes.'],
  [/learning|tuning/i, 'Uses verified prediction results to adjust model indicator weights.', 'Run this after enough predictions have been verified to improve future model calibration.'],
  [/watchlist/i, 'Saves or removes this stock from your personal monitoring list.', 'Click once to change the stock’s watchlist status.'],
  [/refresh/i, 'Requests the latest available information and recalculates the displayed values.', 'Click to refresh this section. It may take a moment while data is fetched.'],
  [/download|report/i, 'Creates a portable report containing the current analysis results.', 'Click to download or open the generated report.'],
  [/sign in|login/i, 'Authenticates your account so the application can load your saved data and permissions.', 'Enter your account details, then click to securely sign in.'],
  [/create account|get started|sign up/i, 'Creates an account so your settings, watchlist, and subscription can be saved.', 'Click to begin account setup.'],
  [/search/i, 'Finds a stock or market symbol and opens its analysis workspace.', 'Type a ticker or company name, then choose a matching result.'],
  [/theme/i, 'Switches the interface between light and dark visual themes.', 'Click to change the display theme.'],
  [/currency/i, 'Changes how monetary values are displayed throughout the application.', 'Click and select your preferred currency.'],
  [/logout|log out/i, 'Ends the current authenticated session on this device.', 'Click when you are finished using the application.'],
];

function cleanText(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function readableName(element: HTMLElement): string {
  const explicit = cleanText(element.dataset.helpTitle);
  if (explicit) return explicit;

  const accessible = cleanText(
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('placeholder')
  );
  if (accessible) return accessible;

  const heading = element.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
  if (heading) return cleanText(heading.innerText);

  const text = cleanText(element.innerText);
  if (text && text.length <= 80) return text;

  if (element.matches('.recharts-wrapper, .recharts-responsive-container')) return 'Interactive chart';
  if (element.matches('table')) return 'Data table';
  if (element.matches('input, textarea')) return 'Text field';
  if (element.matches('select, [role="combobox"]')) return 'Selection menu';
  return 'Interface element';
}

function nearbyHeading(element: HTMLElement): string {
  const cardHeading = element.closest('section, article, [class*="rounded"]')
    ?.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
  if (cardHeading) return cleanText(cardHeading.innerText);

  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      const heading = sibling.matches('h1, h2, h3, h4, h5, h6')
        ? sibling as HTMLElement
        : sibling.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
      if (heading) return cleanText(heading.innerText);
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
  return '';
}

function inferHelpContent(element: HTMLElement): HelpContent {
  const title = readableName(element);
  const customDescription = cleanText(element.dataset.helpDescription);
  const customInstruction = cleanText(element.dataset.helpInstruction);

  if (customDescription) {
    return {
      title,
      description: customDescription,
      instruction: customInstruction || 'Interact with this element to explore or update the related information.',
    };
  }

  const actionGuide = ACTION_GUIDES.find(([pattern]) => pattern.test(title));
  if (actionGuide) {
    return { title, description: actionGuide[1], instruction: actionGuide[2] };
  }

  if (element.matches('.recharts-wrapper, .recharts-responsive-container')) {
    const context = nearbyHeading(element);
    return {
      title: context || 'Interactive chart',
      description: `This chart visualizes ${context ? context.toLowerCase() : 'the current dataset'} so patterns, changes, and outliers are easier to understand.`,
      instruction: 'Move across the chart to inspect individual values. Use the labels and legend to understand each series.',
    };
  }

  if (element.matches('table')) {
    const context = nearbyHeading(element);
    return {
      title: context || 'Data table',
      description: `This table organizes ${context ? context.toLowerCase() : 'detailed records'} into rows and columns for precise comparison.`,
      instruction: 'Read across a row to compare its values. Column headings explain what each value represents.',
    };
  }

  if (element.matches('input, textarea')) {
    return {
      title,
      description: 'This field accepts information used by the current form or analysis.',
      instruction: 'Click the field, enter the requested value, then continue with the related action button.',
    };
  }

  if (element.matches('select, [role="combobox"]')) {
    return {
      title,
      description: 'This menu changes the option used by the current view or calculation.',
      instruction: 'Click the menu and choose one option. The related content will update automatically or after you submit.',
    };
  }

  if (element.matches('a')) {
    const destination = element.getAttribute('href');
    return {
      title,
      description: 'This navigation link opens another part of the application.',
      instruction: `Click to open ${destination && destination !== '#' ? destination : 'the linked page'}.`,
    };
  }

  if (element.matches('button, [role="button"], [role="tab"], [role="switch"]')) {
    return {
      title,
      description: 'This control performs an action or changes the current view.',
      instruction: element.hasAttribute('disabled')
        ? 'This control is currently unavailable. Complete the required step or wait for the current task to finish.'
        : 'Click it once to perform the displayed action.',
    };
  }

  if (element.matches('h1, h2, h3, h4, h5, h6')) {
    return {
      title,
      description: 'This heading identifies the purpose of the information grouped beneath it.',
      instruction: 'Use it to understand the section before reviewing its controls, metrics, or analysis.',
    };
  }

  const context = nearbyHeading(element);
  return {
    title: title || context || 'Information card',
    description: `This section summarizes ${context ? context.toLowerCase() : 'information used in the current workflow'}.`,
    instruction: 'Review the values and labels together. Hover over a more specific control or chart for a focused explanation.',
  };
}

function isEligible(element: HTMLElement): boolean {
  if (element.closest('[data-context-help-ui]')) return false;
  if (element.dataset.helpIgnore !== undefined) return false;
  if (element.dataset.helpDescription || element.dataset.helpTitle) return true;
  if (element.matches('button, a, input, textarea, select, table, h1, h2, h3, [role="button"], [role="tab"], [role="switch"], [role="slider"], [role="combobox"], .recharts-wrapper, .recharts-responsive-container')) return true;

  const classes = element.className;
  return typeof classes === 'string' &&
    classes.includes('border') &&
    (classes.includes('rounded-xl') || classes.includes('rounded-2xl') || classes.includes('rounded-3xl'));
}

function findEligibleTarget(start: EventTarget | null): HTMLElement | null {
  let current = start instanceof Element ? start : null;
  while (current && current !== document.body) {
    if (current instanceof HTMLElement && isEligible(current)) return current;
    current = current.parentElement;
  }
  return null;
}

export default function ContextualHelp() {
  const [hovered, setHovered] = useState<HelpTarget | null>(null);
  const [selected, setSelected] = useState<HelpTarget | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const clearHideTimer = () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    };

    const showForElement = (element: HTMLElement) => {
      clearHideTimer();
      if (hoveredElementRef.current === element) return;
      hoveredElementRef.current = element;
      const rect = element.getBoundingClientRect();
      setHovered({
        element,
        content: inferHelpContent(element),
        x: Math.min(window.innerWidth - 38, Math.max(8, rect.right - 24)),
        y: Math.max(8, rect.top + 8),
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      const element = findEligibleTarget(event.target);
      if (element) {
        showForElement(element);
      } else if (!(event.target instanceof Element && event.target.closest('[data-context-help-ui]'))) {
        clearHideTimer();
        hideTimerRef.current = setTimeout(() => {
          hoveredElementRef.current = null;
          setHovered(null);
        }, 180);
      }
    };

    const handleFocus = (event: FocusEvent) => {
      const element = findEligibleTarget(event.target);
      if (element) showForElement(element);
    };

    const reposition = () => {
      setHovered((current) => {
        if (!current || !document.contains(current.element)) return null;
        const rect = current.element.getBoundingClientRect();
        return {
          ...current,
          x: Math.min(window.innerWidth - 38, Math.max(8, rect.right - 24)),
          y: Math.max(8, rect.top + 8),
        };
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      clearHideTimer();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, []);

  useEffect(() => {
    const element = selected?.element;
    if (!element) return;
    element.classList.add('context-help-selected');
    return () => element.classList.remove('context-help-selected');
  }, [selected]);

  return (
    <>
      {hovered && !selected && (
        <button
          type="button"
          data-context-help-ui
          className="context-help-trigger"
          style={{ left: hovered.x, top: hovered.y }}
          aria-label={`Explain ${hovered.content.title}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelected(hovered);
          }}
        >
          <HelpCircle aria-hidden="true" />
        </button>
      )}

      {selected && (
        <aside
          data-context-help-ui
          className="context-help-panel"
          role="dialog"
          aria-label={`Explanation for ${selected.content.title}`}
        >
          <div className="context-help-panel-accent" />
          <div className="context-help-panel-header">
            <div className="context-help-kicker">
              <Lightbulb aria-hidden="true" />
              Element guide
            </div>
            <button
              type="button"
              data-context-help-ui
              className="context-help-close"
              aria-label="Close element guide"
              onClick={() => setSelected(null)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <h2>{selected.content.title}</h2>
          <p>{selected.content.description}</p>
          <div className="context-help-instruction">
            <MousePointerClick aria-hidden="true" />
            <div>
              <strong>How to use it</strong>
              <span>{selected.content.instruction}</span>
            </div>
          </div>
          <div className="context-help-tip">Press Esc or use the close button when you are finished.</div>
        </aside>
      )}
    </>
  );
}
