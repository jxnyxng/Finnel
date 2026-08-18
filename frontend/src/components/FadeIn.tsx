import React from 'react';

type FadeInProps = {
    children: React.ReactNode;
    as?: React.ElementType;
    delay?: number;
    duration?: number;
    className?: string;
} & React.HTMLAttributes<HTMLElement>;

export function FadeIn({
                           children,
                           as: Component = 'div',
                           delay = 0,
                           duration = 0.4,
                           className = '',
                           style,
                           ...props
                       }: FadeInProps) {
    return (
        <Component
            {...props}
            className={className}
            style={{
                ...style,
                opacity: 0,
                animation: `todayFlowFadeInUp ${duration}s ease-out ${delay}s forwards`
            }}
        >
            {/*
        만약 index.css에 전역 키프레임을 넣으셨다면
        아래 <style> 태그 부분은 지우셔도 됩니다.
      */}
            <style>{`
        @keyframes todayFlowFadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
            {children}
        </Component>
    );
}
