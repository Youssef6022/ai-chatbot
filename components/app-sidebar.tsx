'use client';

import { useRouter } from 'next/navigation';

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
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { useSupabase } from '@/components/supabase-provider';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { user } = useSupabase();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <Link
            href="/"
            onClick={() => {
              setOpenMobile(false);
            }}
            className="flex flex-row items-center gap-3"
          >
            <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
              Magistral
            </span>
          </Link>
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
                  className='flex items-center gap-3 rounded-md px-3 py-2 text-blue-primary hover:bg-blue-primary/10'
                  style={{ 
                    color: 'var(--blue-primary)'
                  }}
                >
                  <div 
                    className='flex h-6 w-6 items-center justify-center rounded-full bg-blue-primary text-white'
                    style={{ backgroundColor: 'var(--blue-primary)', color: 'white' }}
                  >
                    <PlusIcon size={12} />
                  </div>
                  <span>New Chat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/workflows"
                  onClick={() => setOpenMobile(false)}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <WorkflowIcon size={16} />
                  <span>Workflows</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
          </SidebarMenu>
        </div>
        
        <div className='mx-2 border-sidebar-border border-t' />
        
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav />
      </SidebarFooter>
    </Sidebar>
  );
}