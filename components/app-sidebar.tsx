'use client';

import { useRouter } from 'next/navigation';

import { PlusIcon, LibraryIcon, WorkflowIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useSupabase } from '@/components/supabase-provider';

export function AppSidebar() {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { user } = useSupabase();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row items-center justify-between">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row items-center gap-3"
            >
              <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                Chatbot
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="h-8 p-1 md:h-fit md:p-2"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end" className="hidden md:block">
                New Chat
              </TooltipContent>
            </Tooltip>
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
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <PlusIcon size={16} />
                  <span>New Chat</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/library"
                  onClick={() => setOpenMobile(false)}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <LibraryIcon size={16} />
                  <span>Library</span>
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
            
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link
                  href="/workflows/new"
                  onClick={() => setOpenMobile(false)}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <WorkflowIcon size={16} />
                  <span>New Workflow</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
        
        <div className="border-t border-sidebar-border mx-2" />
        
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav />
      </SidebarFooter>
    </Sidebar>
  );
}