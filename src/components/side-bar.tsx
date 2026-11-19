'use client'

import { useState, useEffect, MouseEvent, Fragment } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { CATEGORY_MENUS, CategoryMenuItem } from '../lib/utils/data'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { Drawer, DrawerContent, DrawerHeader } from './ui/drawer'
import { Button } from './ui/button'
import { cn } from 'cn'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from './ui/breadcrumb'

const ITEMS_DELAY_INTERVAL = 60
const ANIMATION_DURATION = 600

interface BreadcrumbEntry {
  menuId: string
  label: string
  filter: string
}

interface MenuAnimState {
  fromMenuId: string
  toMenuId: string
  direction: 'forward' | 'back'
  clickPosition?: number
}

interface SideBarProps {
  isOpen: boolean
  onClose: () => void
  activeFilter: string
  onSelectFilter: (filter: string) => void
}

const SideBar = ({ isOpen, onClose, activeFilter, onSelectFilter }: SideBarProps) => {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { menuId: 'main', label: 'all', filter: 'all' },
  ])
  const [animState, setAnimState] = useState<MenuAnimState | null>(null)
  const isMobile = useIsMobile()

  const currentMenuId = breadcrumbs[breadcrumbs.length - 1].menuId

  useEffect(() => {
    if (animState) return
    if (activeFilter === 'all') {
      setBreadcrumbs([{ menuId: 'main', label: 'all', filter: 'all' }])
      return
    }
    const topSubmenuId = `submenu-${activeFilter}`
    if (CATEGORY_MENUS[topSubmenuId]) {
      const currentCrumb = breadcrumbs[breadcrumbs.length - 1]
      const currentMenu = CATEGORY_MENUS[currentCrumb.menuId]
      const belongsToCurrentMenu =
        currentCrumb.menuId === topSubmenuId || currentMenu?.parentId === topSubmenuId
      if (!belongsToCurrentMenu) {
        setBreadcrumbs([
          { menuId: 'main', label: 'all', filter: 'all' },
          {
            menuId: topSubmenuId,
            label: CATEGORY_MENUS[topSubmenuId].name,
            filter: activeFilter,
          },
        ])
      }
    }
  }, [activeFilter])

  const navigateToMenu = (
    targetMenuId: string,
    nextBreadcrumbs: BreadcrumbEntry[],
    direction: 'forward' | 'back',
    clickPosition?: number,
  ) => {
    if (animState || targetMenuId === currentMenuId) return

    const targetMenu = CATEGORY_MENUS[targetMenuId]
    const itemCount = targetMenu ? targetMenu.items.length : 1
    const maxDelay = itemCount * ITEMS_DELAY_INTERVAL

    setAnimState({
      fromMenuId: currentMenuId,
      toMenuId: targetMenuId,
      direction,
      clickPosition,
    })

    setTimeout(() => {
      setBreadcrumbs(nextBreadcrumbs)
      setAnimState(null)
    }, ANIMATION_DURATION + maxDelay)
  }

  const handleMenuItemClick = (
    ev: MouseEvent<HTMLAnchorElement>,
    item: CategoryMenuItem,
    pos: number,
  ) => {
    ev.preventDefault()
    if (animState) return

    if (item.submenu && CATEGORY_MENUS[item.submenu]) {
      const nextBreadcrumbs: BreadcrumbEntry[] = [
        ...breadcrumbs,
        {
          menuId: item.submenu,
          label: item.label,
          filter: item.filter || 'all',
        },
      ]
      if (item.filter) {
        onSelectFilter(item.filter)
      }
      navigateToMenu(item.submenu, nextBreadcrumbs, 'forward', pos)
    } else if (item.filter) {
      onSelectFilter(item.filter)
    }
  }

  const handleBack = () => {
    if (animState || breadcrumbs.length <= 1) return
    const nextBreadcrumbs = breadcrumbs.slice(0, -1)
    const parentCrumb = nextBreadcrumbs[nextBreadcrumbs.length - 1]
    if (parentCrumb?.filter) {
      onSelectFilter(parentCrumb.filter)
    }
    navigateToMenu(parentCrumb.menuId, nextBreadcrumbs, 'back', undefined)
  }

  const handleBreadcrumbClick = (ev: MouseEvent<HTMLAnchorElement>, index: number) => {
    ev.preventDefault()
    if (animState || index === breadcrumbs.length - 1) return
    const nextBreadcrumbs = breadcrumbs.slice(0, index + 1)
    const targetCrumb = nextBreadcrumbs[nextBreadcrumbs.length - 1]
    if (targetCrumb?.filter) {
      onSelectFilter(targetCrumb.filter)
    }
    navigateToMenu(targetCrumb.menuId, nextBreadcrumbs, 'back', undefined)
  }

  const getItemDelay = (pos: number, isBackNavigation: boolean, clickPosition?: number) => {
    const delayMs = isBackNavigation
      ? pos * ITEMS_DELAY_INTERVAL
      : Math.abs((clickPosition ?? 0) - pos) * ITEMS_DELAY_INTERVAL
    return `${delayMs}ms`
  }

  return (
    <Drawer
      open={isOpen}
      onOpenChange={onClose}
      showSwipeHandle={isMobile}
      swipeDirection={isMobile ? 'down' : 'left'}
      aria-label="Category Menu"
    >
      <DrawerContent>
        <DrawerHeader>
          <Button
            type="button"
            className={cn('absolute z-100 top-3 right-2', breadcrumbs.length <= 1 && ' hidden')}
            aria-label="Go back"
            onClick={handleBack}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          <Breadcrumb className="p-2">
            <BreadcrumbList>
              {breadcrumbs.map((crumb, idx) => (
                <Fragment key={`${crumb.menuId}-${idx}`}>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      onClick={(ev) => handleBreadcrumbClick(ev, idx)}
                      className={cn(
                        'cursor-pointer text-xs transition-colors hover:text-foreground',
                        idx === breadcrumbs.length - 1
                          ? 'text-foreground'
                          : 'text-muted-foreground',
                      )}
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {!(idx === breadcrumbs.length - 1) && (
                    <BreadcrumbSeparator className="text-muted-foreground/40" />
                  )}
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </DrawerHeader>

        <div className="relative min-h-[50vh] h-full overflow-auto">
          {Object.values(CATEGORY_MENUS).map((menu) => {
            const isCurrent = !animState && menu.id === currentMenuId
            const isAnimatingOut = animState && menu.id === animState.fromMenuId
            const isAnimatingIn = animState && menu.id === animState.toMenuId
            const isBack = animState?.direction === 'back'

            let levelClasses = 'menu__level'
            if (isCurrent || isAnimatingOut) {
              levelClasses += ' menu__level--current'
            }
            if (isAnimatingOut) {
              levelClasses += isBack ? ' animate-outToRight' : ' animate-outToLeft'
            }
            if (isAnimatingIn) {
              levelClasses += isBack ? ' animate-inFromLeft' : ' animate-inFromRight'
            }

            return (
              <ul
                key={menu.id}
                data-menu={menu.id}
                id={menu.id}
                className={levelClasses}
                tabIndex={-1}
                role="menu"
                aria-label={menu.name}
              >
                {menu.items.map((item, pos) => {
                  const isSelected = !item.submenu && activeFilter === item.filter
                  const delay =
                    isAnimatingOut || isAnimatingIn
                      ? getItemDelay(pos, Boolean(isBack), animState?.clickPosition)
                      : '0ms'

                  return (
                    <li
                      key={`${menu.id}-${item.label}`}
                      className="menu__item"
                      role="menuitem"
                      style={{
                        animationDelay: delay,
                        WebkitAnimationDelay: delay,
                      }}
                    >
                      <a
                        className={`menu__link${isSelected ? ' menu__link--current' : ''}`}
                        data-submenu={item.submenu || undefined}
                        aria-owns={item.submenu || undefined}
                        href={`#${item.filter || item.submenu}`}
                        onClick={(ev) => handleMenuItemClick(ev, item, pos)}
                      >
                        {item.label}
                        {item.submenu && (
                          <ChevronRight className="h-4 w-4 opacity-60" aria-hidden="true" />
                        )}
                      </a>
                    </li>
                  )
                })}
              </ul>
            )
          })}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export default SideBar
