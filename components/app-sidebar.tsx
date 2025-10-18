'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PlusIcon, WorkflowIcon, FileIcon } from '@/components/icons';
import { ChevronLeft, PanelLeft } from 'lucide-react';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { useSupabase } from '@/components/supabase-provider';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile, state } = useSidebar();
  const { user } = useSupabase();
  const [isClient, setIsClient] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Pour éviter l'erreur d'hydratation, on utilise une classe CSS qui fonctionne côté serveur et client
  const getItemClassName = (baseClasses: string) => {
    if (!isClient) {
      // Côté serveur, utiliser les classes par défaut (expanded)
      return `${baseClasses} gap-3 px-3 py-3`;
    }
    // Côté client, utiliser l'état réel
    const isCollapsed = state === 'collapsed';
    return `${baseClasses} ${isCollapsed ? 'justify-center p-3 w-full' : 'gap-3 px-3 py-3 w-full'}`;
  };

  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar className='transition-all duration-300 ease-in-out group-data-[side=left]:border-r-0' collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <div className='flex min-h-[48px] items-center px-2'>
            <button
              onClick={toggleSidebar}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className='flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground'
              title={isClient && state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isClient && state === 'collapsed' ? (
                <PanelLeft size={16} />
              ) : (
                // Sidebar ouverte : PanelLeft par défaut, ChevronLeft au hover
                isHovered ? (
                  <ChevronLeft size={16} />
                ) : (
                  <PanelLeft size={16} />
                )
              )}
            </button>
            {(!isClient || state !== 'collapsed') && (
              <Link
                href="/"
                onClick={() => {
                  setOpenMobile(false);
                }}
                className='ml-3 flex-1'
              >
                <span className='cursor-pointer rounded-md px-2 py-1 font-semibold text-lg transition-colors hover:bg-muted'>
                  Magistral
                </span>
              </Link>
            )}
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="flex flex-col">
        {/* Section fixe - Navigation principale */}
        <div className='flex-shrink-0 border-sidebar-border border-b'>
          <div className="flex flex-col gap-2 p-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/"
                    onClick={() => {
                      setOpenMobile(false);
                      router.refresh();
                    }}
                    className='flex min-h-[32px] items-center rounded-md px-2 text-blue-primary transition-colors hover:bg-blue-primary/10'
                    style={{ 
                      color: 'var(--blue-primary)'
                    }}
                    title={isClient && state === 'collapsed' ? "New Chat" : undefined}
                  >
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-primary text-white ${
                        isClient && state === 'collapsed' ? 'mx-auto' : 'mr-0.5'
                      }`}
                      style={{
                        backgroundColor: 'var(--blue-primary)',
                        color: 'white'
                      }}
                    >
                      <PlusIcon size={12} />
                    </div>
                    {(!isClient || state !== 'collapsed') && (
                      <span className='font-medium text-sm transition-opacity duration-200'>New Chat</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/workflows-library"
                    onClick={() => setOpenMobile(false)}
                    className='flex min-h-[32px] items-center rounded-md px-2 transition-colors hover:bg-accent'
                    title={isClient && state === 'collapsed' ? "Workflows" : undefined}
                  >
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center ${
                        isClient && state === 'collapsed' ? 'mx-auto' : 'mr-0.5'
                      }`}
                    >
                      <WorkflowIcon size={14} />
                    </div>
                    {(!isClient || state !== 'collapsed') && (
                      <span className='font-medium text-sm transition-opacity duration-200'>Workflows</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/library"
                    onClick={() => setOpenMobile(false)}
                    className='flex min-h-[32px] items-center rounded-md px-2 transition-colors hover:bg-accent'
                    title={isClient && state === 'collapsed' ? "Library" : undefined}
                  >
                    <div
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center ${
                        isClient && state === 'collapsed' ? 'mx-auto' : 'mr-0.5'
                      }`}
                    >
                      <FileIcon size={14} />
                    </div>
                    {(!isClient || state !== 'collapsed') && (
                      <span className='font-medium text-sm transition-opacity duration-200'>Library</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </div>
        
        {/* Section défilante - Historique */}
        {(!isClient || state !== 'collapsed') && (
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-border/80">
            <SidebarHistory user={user} isCollapsed={isClient && state === 'collapsed'} />
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav isCollapsed={isClient && state === 'collapsed'} />
      </SidebarFooter>
    </Sidebar>
  );
}