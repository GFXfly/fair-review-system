'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './picker.module.css';
import { usePopover } from './use-popover';
import { CheckIcon, ChevronDownIcon } from './Icons';

export interface SelectOption<V extends string = string> {
    value: V;
    label: string;
    hint?: string;
    disabled?: boolean;
}

export interface CustomSelectProps<V extends string = string> {
    value: V;
    onChange: (value: V) => void;
    options: readonly SelectOption<V>[];
    placeholder?: string;
    size?: 'md' | 'sm';
    disabled?: boolean;
    required?: boolean;
    icon?: React.ReactNode;
    id?: string;
    name?: string;
    className?: string;
    /** 浮层最小宽度（默认与触发器等宽） */
    menuMinWidth?: number;
    'aria-label'?: string;
}

/**
 * 通用精致下拉菜单：用于工具栏筛选、角色选择等短列表。
 * 浮层经 createPortal 挂载到 body，支持 ↑/↓/Enter/Esc 键盘操作。
 */
export default function CustomSelect<V extends string = string>({
    value,
    onChange,
    options,
    placeholder = '请选择',
    size = 'md',
    disabled,
    required,
    icon,
    id,
    name,
    className,
    menuMinWidth,
    'aria-label': ariaLabel,
}: CustomSelectProps<V>) {
    const autoId = useId();
    const listId = `${autoId}-list`;
    const { triggerRef, popoverRef, open, setOpen, position, popoverStyle } = usePopover<HTMLButtonElement>({
        preferredHeight: 300,
        minWidth: menuMinWidth,
        maxWidth: 420,
    });
    const [activeIndex, setActiveIndex] = useState(-1);
    const listRef = useRef<HTMLUListElement | null>(null);

    const selectedIndex = options.findIndex((opt) => opt.value === value);
    const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

    /** 打开时把键盘高亮项同步到当前选中项 */
    const toggle = (next: boolean) => {
        if (next) setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(next);
    };

    useEffect(() => {
        if (!open || activeIndex < 0) return;
        const node = listRef.current?.children[activeIndex] as HTMLElement | undefined;
        node?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, open]);

    const choose = (opt: SelectOption<V>) => {
        if (opt.disabled) return;
        onChange(opt.value);
        setOpen(false);
        triggerRef.current?.focus();
    };

    const move = (delta: number) => {
        if (!options.length) return;
        let next = activeIndex;
        for (let i = 0; i < options.length; i += 1) {
            next = (next + delta + options.length) % options.length;
            if (!options[next].disabled) break;
        }
        setActiveIndex(next);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (!open) {
            if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
                event.preventDefault();
                toggle(true);
            }
            return;
        }
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                move(1);
                break;
            case 'ArrowUp':
                event.preventDefault();
                move(-1);
                break;
            case 'Home':
                event.preventDefault();
                setActiveIndex(0);
                break;
            case 'End':
                event.preventDefault();
                setActiveIndex(options.length - 1);
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (options[activeIndex]) choose(options[activeIndex]);
                break;
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                break;
            case 'Tab':
                setOpen(false);
                break;
            default:
                break;
        }
    };

    return (
        <div className={styles.field}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                role="combobox"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={open ? listId : undefined}
                aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
                aria-label={ariaLabel}
                className={[
                    styles.trigger,
                    size === 'sm' ? styles.triggerSm : '',
                    open ? styles.triggerOpen : '',
                    className || '',
                ].join(' ')}
                onClick={() => toggle(!open)}
                onKeyDown={handleKeyDown}
            >
                {icon && <span className={styles.prefixIcon}>{icon}</span>}
                <span className={`${styles.triggerValue} ${selected ? '' : styles.triggerPlaceholder}`}>
                    {selected ? selected.label : placeholder}
                </span>
                <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
                    <ChevronDownIcon size={size === 'sm' ? 14 : 16} />
                </span>
            </button>
            {required && (
                <input
                    className={styles.validityProxy}
                    tabIndex={-1}
                    aria-hidden="true"
                    name={name}
                    value={value}
                    onChange={() => undefined}
                    onFocus={() => triggerRef.current?.focus()}
                    required
                />
            )}

            {open && popoverStyle && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popoverRef}
                    className={`${styles.popover} ${position?.placement === 'top' ? styles.popoverTop : ''}`}
                    style={popoverStyle}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => {
                        // 保持焦点在触发器上，键盘操作不中断
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    <ul ref={listRef} id={listId} role="listbox" className={styles.list}>
                        {options.map((opt, index) => {
                            const isSelected = opt.value === value;
                            return (
                                <li
                                    key={opt.value || `__empty_${index}`}
                                    id={`${listId}-${index}`}
                                    role="option"
                                    aria-selected={isSelected}
                                    aria-disabled={opt.disabled || undefined}
                                    className={[
                                        styles.option,
                                        index === activeIndex ? styles.optionActive : '',
                                        isSelected ? styles.optionSelected : '',
                                        opt.disabled ? styles.optionDisabled : '',
                                    ].join(' ')}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => choose(opt)}
                                >
                                    <span className={styles.optionLabel}>{opt.label}</span>
                                    {opt.hint && <span className={styles.optionHint}>{opt.hint}</span>}
                                    <span className={styles.optionCheck}>
                                        {isSelected && <CheckIcon size={15} strokeWidth={2} />}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>,
                document.body,
            )}
        </div>
    );
}
