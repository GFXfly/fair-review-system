'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';

export interface PopoverPosition {
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
    placement: 'bottom' | 'top';
}

interface UsePopoverOptions {
    /** 浮层期望的最大高度（px） */
    preferredHeight: number;
    /** 浮层最小宽度；默认与触发器等宽 */
    minWidth?: number;
    /** 浮层最大宽度 */
    maxWidth?: number;
    /** 触发器与浮层的间距 */
    gap?: number;
}

const VIEWPORT_MARGIN = 8;

/**
 * 计算 fixed 定位浮层的位置：默认在触发器下方，空间不足时自动向上弹出；
 * 点击外部、外部滚动、窗口尺寸变化时自动收起。浮层通过 createPortal 挂到 body，
 * 因此不会被弹窗或容器的 overflow 裁切。
 */
export function usePopover<T extends HTMLElement>(options: UsePopoverOptions) {
    const { preferredHeight, minWidth = 0, maxWidth = 640, gap = 6 } = options;
    const triggerRef = useRef<T | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState<PopoverPosition | null>(null);

    const computePosition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;
        const rect = trigger.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const width = Math.min(
            Math.max(rect.width, minWidth),
            maxWidth,
            vw - VIEWPORT_MARGIN * 2,
        );
        const left = Math.min(
            Math.max(rect.left, VIEWPORT_MARGIN),
            vw - width - VIEWPORT_MARGIN,
        );

        const spaceBelow = vh - rect.bottom - gap - VIEWPORT_MARGIN;
        const spaceAbove = rect.top - gap - VIEWPORT_MARGIN;
        const needed = Math.min(preferredHeight, 260);
        const placeTop = spaceBelow < needed && spaceAbove > spaceBelow;

        if (placeTop) {
            setPosition({
                bottom: vh - rect.top + gap,
                left,
                width,
                maxHeight: Math.max(160, Math.min(preferredHeight, spaceAbove)),
                placement: 'top',
            });
        } else {
            setPosition({
                top: rect.bottom + gap,
                left,
                width,
                maxHeight: Math.max(160, Math.min(preferredHeight, spaceBelow)),
                placement: 'bottom',
            });
        }
    }, [gap, maxWidth, minWidth, preferredHeight]);

    useLayoutEffect(() => {
        if (open) computePosition();
    }, [open, computePosition]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (popoverRef.current?.contains(target)) return;
            if (triggerRef.current?.contains(target)) return;
            setOpen(false);
        };

        const handleScroll = (event: Event) => {
            const target = event.target as Node | null;
            if (target && popoverRef.current?.contains(target)) return;
            setOpen(false);
        };

        const handleResize = () => setOpen(false);

        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('touchstart', handlePointerDown);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('touchstart', handlePointerDown);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
        };
    }, [open]);

    const popoverStyle: React.CSSProperties | undefined = position
        ? {
            position: 'fixed',
            top: position.top,
            bottom: position.bottom,
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            zIndex: 2000,
        }
        : undefined;

    return {
        triggerRef,
        popoverRef,
        open,
        setOpen,
        position,
        popoverStyle,
    };
}
