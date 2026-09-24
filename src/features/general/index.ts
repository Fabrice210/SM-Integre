// Inscription des pages, formulaires et fiches du module (registerPages, registerForms, registerDetails).
import { registerPages } from '../../app/pages'
import { registerForms } from '../../forms/registry'
import { CoverPage } from './CoverPage'
import { DashboardPage } from './DashboardPage'
import { usersForm } from './forms'
import { HelpPage } from './HelpPage'
import { JournalPage } from './JournalPage'
import { SettingsPage } from './SettingsPage'
import { UsersPage } from './UsersPage'

registerPages({
  dashboard: DashboardPage,
  cover: CoverPage,
  journal: JournalPage,
  users: UsersPage,
  settings: SettingsPage,
  help: HelpPage,
})

registerForms({ users: usersForm })
