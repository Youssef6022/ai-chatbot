'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PlusIcon, WorkflowIcon } from '@/components/icons';
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
  const isCollapsed = isClient && state === 'collapsed';

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <Sidebar className="group-data-[side=left]:border-r-0" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex items-center justify-between">
            {isCollapsed ? (
              <SidebarTrigger className="ml-auto" />
            ) : (
              <>
                <SidebarTrigger />
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
                  className={`flex items-center rounded-md text-blue-primary hover:bg-blue-primary/10 ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3'}`}
                  style={{ 
                    color: 'var(--blue-primary)'
                  }}
                  title={isCollapsed ? "New Chat" : undefined}
                >
                  <div 
                    className='flex h-7 w-7 items-center justify-center rounded-full bg-blue-primary text-white flex-shrink-0'
                    style={{ backgroundColor: 'var(--blue-primary)', color: 'white' }}
                  >
                    <PlusIcon size={14} />
                  </div>
                  {!isCollapsed && <span>New Chat</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/workflows"
                  onClick={() => setOpenMobile(false)}
                  className={`flex items-center ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-3'}`}
                  title={isCollapsed ? "Workflows" : undefined}
                >
                  <WorkflowIcon size={16} />
                  {!isCollapsed && <span>Workflows</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
          </SidebarMenu>
        </div>
        
        {!isCollapsed && (
          <>
            <div className='mx-2 border-sidebar-border border-t' />
            <SidebarHistory user={user} isCollapsed={isCollapsed} />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav isCollapsed={isCollapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}