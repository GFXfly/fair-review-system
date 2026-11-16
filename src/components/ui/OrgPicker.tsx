'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './picker.module.css';
import { usePopover } from './use-popover';
import { BuildingIcon, ChevronDownIcon, CloseIcon, SearchIcon } from './Icons';

export interface OrgPickerProps {
    value: string;
    onChange: (value: string) => void;
    /** 可选项（镇街 TOWN_LIST 或区级部门 GOV_DEPT_LIST） */
    options: readonly string[];
    placeholder?: string;
    /** 浮层标题，如「选择所属镇街」 */
    title?: string;
    /** 单位名词，用于计数提示，如「镇街」「部门」 */
    unitLabel?: string;
    searchPlaceholder?: string;
    disabled?: boolean;
    required?: boolean;
    invalid?: boolean;
    size?: 'md' | 'sm';
    id?: string;
    name?: string;
    className?: string;
    'aria-label'?: string;
}

function highlight(text: string, keyword: string) {
    if (!keyword) return text;
    const index = text.indexOf(keyword);
    if (index < 0) return text;
    return (
        <>
            {text.slice(0, index)}
            <mark className={styles.mark}>{text.slice(index, index + keyword.length)}</mark>
            {text.slice(index + keyword.length)}
        </>
    );
}

/**
 * 镇街 / 区级部门矩阵选择器：触发器外观同输入框，点击后弹出
 * 4 列方块网格浮层，可即时检索，一眼看全、一点即中。
 */
export default function OrgPicker({
    value,
    onChange,
    options,
    placeholder = '请选择',
    title = '请选择',
    unitLabel = '项',
    searchPlaceholder = '快速检索镇街 / 部门名称...',
    disabled,
    required,
    invalid,
    size = 'md',
    id,
    name,
    className,
    'aria-label': ariaLabel,
}: OrgPickerProps) {
    const autoId = useId();
    const panelId = `${autoId}-panel`;
    const { triggerRef, popoverRef, open, setOpen, position, popoverStyle } = usePopover<HTMLButtonElement>({
        preferredHeight: 420,
        minWidth: 468,
        maxWidth: 520,
    });
    const [keyword, setKeyword] = useState('');
    const [focusIndex, setFocusIndex] = useState(-1);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const filtered = useMemo(() => {
        const k = keyword.trim();
        if (!k) return [...options];
        return options.filter((item) => item.includes(k));
    }, [keyword, options]);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
        return () => window.clearTimeout(timer);
    }, [open]);

    const toggle = (next: boolean) => {
        if (next) {
            setKeyword('');
            setFocusIndex(-1);
        }
        setOpen(next);
    };

    const close = (restoreFocus = true) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
    };

    const select = (item: string) => {
        onChange(item);
        close();
    };

    const handlePanelKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
        }
        if (event.key === 'Tab') {
            close(false);
            return;
        }
        if (!filtered.length) return;
        const cols = 4;
        let next = focusIndex;
        if (event.key === 'ArrowRight') next = focusIndex < 0 ? 0 : Math.min(filtered.length - 1, focusIndex + 1);
        else if (event.key === 'ArrowLeft') next = Math.max(0, focusIndex - 1);
        else if (event.key === 'ArrowDown') next = focusIndex < 0 ? 0 : Math.min(filtered.length - 1, focusIndex + cols);
        else if (event.key === 'ArrowUp') next = Math.max(0, focusIndex - cols);
        else if (event.key === 'Enter') {
            event.preventDefault();
            const target = filtered[focusIndex >= 0 ? focusIndex : 0];
            if (target) select(target);
            return;
        } else {
            return;
        }
        event.preventDefault();
        setFocusIndex(next);
    };

    const handleTriggerKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            toggle(true);
        }
        if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        }
    };

    const isLegacy = Boolean(value) && !options.includes(value);

    return (
        <div className={styles.field}>
            <button
                ref={triggerRef}
                id={id}
                type="button"
                disabled={disabled}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={ariaLabel}
                className={[
                    styles.trigger,
                    size === 'sm' ? styles.triggerSm : '',
                    open ? styles.triggerOpen : '',
                    invalid ? styles.triggerInvalid : '',
                    className || '',
                ].join(' ')}
                onClick={() => toggle(!open)}
                onKeyDown={handleTriggerKeyDown}
            >
                <span className={styles.prefixIcon}><BuildingIcon size={16} /></span>
                <span className={`${styles.triggerValue} ${value ? '' : styles.triggerPlaceholder}`}>
                    {value || placeholder}
                </span>
                {isLegacy && <span className={styles.triggerTag}>旧名称</span>}
                <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
                    <ChevronDownIcon size={16} />
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
                    id={panelId}
                    role="dialog"
                    aria-label={title}
                    className={`${styles.popover} ${position?.placement === 'top' ? styles.popoverTop : ''}`}
                    style={popoverStyle}
                    onKeyDown={handlePanelKeyDown}
                    // 浮层经 portal 挂在 body，但 React 合成事件仍会沿组件树冒泡；
                    // 拦截后避免触发外层弹窗遮罩的「点击关闭」等逻辑。
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className={styles.orgHead}>
                        <div className={styles.orgHeadRow}>
                            <span className={styles.orgTitle}>{title}</span>
                            <span className={styles.orgCount}>
                                {keyword.trim()
                                    ? `匹配 ${filtered.length} / ${options.length} 个${unitLabel}`
                                    : `共 ${options.length} 个${unitLabel}`}
                            </span>
                        </div>
                        <div className={styles.searchBox}>
                            <span className={styles.searchIcon}><SearchIcon size={14} /></span>
                            <input
                                ref={searchRef}
                                className={styles.searchInput}
                                placeholder={searchPlaceholder}
                                value={keyword}
                                onChange={(e) => {
                                    setKeyword(e.target.value);
                                    setFocusIndex(-1);
                                }}
                                aria-label={searchPlaceholder}
                            />
                            {keyword && (
                                <button
                                    type="button"
                                    className={styles.searchClear}
                                    onClick={() => {
                                        setKeyword('');
                                        searchRef.current?.focus();
                                    }}
                                    aria-label="清空检索"
                                >
                                    <CloseIcon size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className={styles.orgBody}>
                        {filtered.length === 0 ? (
                            <div className={styles.empty}>未找到包含「{keyword.trim()}」的{unitLabel}</div>
                        ) : (
                            <div className={styles.chipGrid} role="listbox" aria-label={title}>
                                {filtered.map((item, index) => {
                                    const active = item === value;
                                    return (
                                        <button
                                            key={item}
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            title={item}
                                            className={[
                                                styles.chip,
                                                active ? styles.chipActive : '',
                                                index === focusIndex ? styles.chipFocus : '',
                                            ].join(' ')}
                                            onClick={() => select(item)}
                                            onMouseEnter={() => setFocusIndex(index)}
                                        >
                                            <span>{highlight(item, keyword.trim())}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className={styles.orgFoot}>
                        <span>{value ? `当前：${value}` : '尚未选择'}</span>
                        <span><kbd>↵</kbd>选中 <kbd>Esc</kbd>收起</span>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
