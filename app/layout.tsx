import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'春秋象棋 · 与友对弈',description:'无需注册，分享房间，开始一局春秋象棋。支持远程联机与观战。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
