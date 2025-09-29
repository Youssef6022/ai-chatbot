'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PlusIcon, WorkflowIcon, FileIcon } from '@/components/icons';
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
    return `${baseClasses} ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3'}`;
  };

  return (
    <Sidebar className="group-data-[side=left]:border-r-0" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex items-center justify-between">
            {isClient && state === 'collapsed' ? (
              <SidebarTrigger className="ml-auto" />
            ) : (
              <>
                <SidebarTrigger />
                {(!isClient || state !== 'collapsed') && (
                  <Link
                    href="/"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                    className="flex-1 ml-2"
                  >
                    <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                      Magistral
                    </span>
                  </Link>
                )}
              </>
            )}
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="flex flex-col gap-4 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/"
                  onClick={() => {
                    setOpenMobile(false);
                    router.refresh();
                  }}
                  className={getItemClassName('flex items-center rounded-md text-blue-primary hover:bg-blue-primary/10')}
                  style={{ 
                    color: 'var(--blue-primary)'
                  }}
                  title={isClient && state === 'collapsed' ? "New Chat" : undefined}
                >
                  <div 
                    className='flex h-7 w-7 items-center justify-center rounded-full bg-blue-primary text-white flex-shrink-0'
                    style={{ backgroundColor: 'var(--blue-primary)', color: 'white' }}
                  >
                    <PlusIcon size={14} />
                  </div>
                  {(!isClient || state !== 'collapsed') && <span>New Chat</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/workflows-library"
                  onClick={() => setOpenMobile(false)}
                  className={getItemClassName('flex items-center')}
                  title={isClient && state === 'collapsed' ? "Workflows" : undefined}
                >
                  <WorkflowIcon size={16} />
                  {(!isClient || state !== 'collapsed') && <span>Workflows</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/library"
                  onClick={() => setOpenMobile(false)}
                  className={getItemClassName('flex items-center')}
                  title={isClient && state === 'collapsed' ? "Library" : undefined}
                >
                  <FileIcon size={16} />
                  {(!isClient || state !== 'collapsed') && <span>Library</span>}
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