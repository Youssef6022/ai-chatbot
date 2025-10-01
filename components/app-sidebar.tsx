'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PlusIcon, WorkflowIcon, FileIcon } from '@/components/icons';
import { ChevronLeft } from 'lucide-react';
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { useSupabase } from '@/components/supabase-provider';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile, state } = useSidebar();
  const { user } = useSupabase();
  const [isClient, setIsClient] = useState(false);

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
    <Sidebar className="group-data-[side=left]:border-r-0 transition-all duration-300 ease-in-out" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex items-center min-h-[48px] px-2">
            <button
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
              title={isClient && state === 'collapsed' ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isClient && state === 'collapsed' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h18m-9-9l9 9-9 9"/>
                </svg>
              ) : (
                <ChevronLeft size={16} />
              )}
            </button>
            {(!isClient || state !== 'collapsed') && (
              <Link
                href="/"
                onClick={() => {
                  setOpenMobile(false);
                }}
                className="flex-1 ml-3"
              >
                <span className="cursor-pointer rounded-md px-2 py-1 font-semibold text-lg hover:bg-muted transition-colors">
                  Magistral
                </span>
              </Link>
            )}
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
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
                  className="flex items-center rounded-md text-blue-primary hover:bg-blue-primary/10 transition-colors min-h-[32px] px-2"
                  style={{ 
                    color: 'var(--blue-primary)'
                  }}
                  title={isClient && state === 'collapsed' ? "New Chat" : undefined}
                >
                  <div 
                    className='flex h-5 w-5 items-center justify-center rounded-full bg-blue-primary text-white flex-shrink-0 mx-auto'
                    style={{ 
                      backgroundColor: 'var(--blue-primary)', 
                      color: 'white',
                      marginLeft: isClient && state === 'collapsed' ? 'auto' : '0',
                      marginRight: isClient && state === 'collapsed' ? 'auto' : '8px'
                    }}
                  >
                    <PlusIcon size={12} />
                  </div>
                  {(!isClient || state !== 'collapsed') && (
                    <span className="text-sm font-medium transition-opacity duration-200">New Chat</span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/workflows-library"
                  onClick={() => setOpenMobile(false)}
                  className="flex items-center rounded-md hover:bg-accent transition-colors min-h-[32px] px-2"
                  title={isClient && state === 'collapsed' ? "Workflows" : undefined}
                >
                  <div 
                    className="flex h-5 w-5 items-center justify-center flex-shrink-0"
                    style={{
                      marginLeft: isClient && state === 'collapsed' ? 'auto' : '0',
                      marginRight: isClient && state === 'collapsed' ? 'auto' : '8px'
                    }}
                  >
                    <WorkflowIcon size={14} />
                  </div>
                  {(!isClient || state !== 'collapsed') && (
                    <span className="text-sm font-medium transition-opacity duration-200">Workflows</span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/library"
                  onClick={() => setOpenMobile(false)}
                  className="flex items-center rounded-md hover:bg-accent transition-colors min-h-[32px] px-2"
                  title={isClient && state === 'collapsed' ? "Library" : undefined}
                >
                  <div 
                    className="flex h-5 w-5 items-center justify-center flex-shrink-0"
                    style={{
                      marginLeft: isClient && state === 'collapsed' ? 'auto' : '0',
                      marginRight: isClient && state === 'collapsed' ? 'auto' : '8px'
                    }}
                  >
                    <FileIcon size={14} />
                  </div>
                  {(!isClient || state !== 'collapsed') && (
                    <span className="text-sm font-medium transition-opacity duration-200">Library</span>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
          </SidebarMenu>
        </div>
        
        {(!isClient || state !== 'collapsed') && (
          <>
            <div className='mx-2 border-sidebar-border border-t' />
            <SidebarHistory user={user} isCollapsed={isClient && state === 'collapsed'} />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav isCollapsed={isClient && state === 'collapsed'} />
      </SidebarFooter>
    </Sidebar>
  );
}